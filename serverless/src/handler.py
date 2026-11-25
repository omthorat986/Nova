"""Process NOVA observation manifests uploaded to the raw S3 prefix."""

import json
import logging
import os
from datetime import datetime, timezone
from urllib.parse import unquote_plus

import boto3


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")
INPUT_PREFIX = "uploads/raw/"
OUTPUT_PREFIX = os.getenv("OUTPUT_PREFIX", "uploads/processed/").strip("/") + "/"
try:
    TIMEOUT_BUFFER_SEC = max(0, int(os.getenv("TIMEOUT_BUFFER_SEC", "5")))
except ValueError:
    TIMEOUT_BUFFER_SEC = 5

REQUIRED_FIELDS = ("observation_id", "agency_or_channel", "timestamp", "media_key")


def _validate_payload(payload):
    if not isinstance(payload, dict):
        return "Payload must be a JSON object."

    missing = [
        field
        for field in REQUIRED_FIELDS
        if not isinstance(payload.get(field), str) or not payload[field].strip()
    ]
    if missing:
        return "Missing or invalid required field(s): " + ", ".join(missing)
    return None


def _processed_key(raw_key):
    relative_key = raw_key[len(INPUT_PREFIX) :]
    if not relative_key.lower().endswith(".json"):
        relative_key += ".json"
    return OUTPUT_PREFIX + relative_key


def _source_metadata(record, bucket, key):
    source = {"bucket": bucket, "key": key}
    object_data = record.get("s3", {}).get("object", {})
    if object_data.get("eTag"):
        source["etag"] = object_data["eTag"]
    if object_data.get("versionId"):
        source["version_id"] = object_data["versionId"]
    return source


def _record_result(index, status, **details):
    return {"record": index, "status": status, **details}


def lambda_handler(event, context):
    """Validate and enrich each S3 notification record independently."""
    records = event.get("Records", []) if isinstance(event, dict) else []
    results = []
    deferred = False

    for index, record in enumerate(records):
        if context.get_remaining_time_in_millis() < TIMEOUT_BUFFER_SEC * 1000:
            deferred = True
            results.extend(
                _record_result(remaining_index, "deferred", message="Timeout safety buffer reached.")
                for remaining_index in range(index, len(records))
            )
            break

        try:
            s3_data = record["s3"]
            bucket = s3_data["bucket"]["name"]
            key = unquote_plus(s3_data["object"]["key"])
        except (KeyError, TypeError) as error:
            results.append(_record_result(index, "invalid_event", message=f"Malformed S3 record: {error}"))
            continue

        if key.startswith(OUTPUT_PREFIX):
            results.append(_record_result(index, "skipped", key=key, reason="output_prefix"))
            continue
        if not key.startswith(INPUT_PREFIX):
            results.append(_record_result(index, "skipped", key=key, reason="outside_input_prefix"))
            continue

        try:
            response = s3_client.get_object(Bucket=bucket, Key=key)
            payload = json.loads(response["Body"].read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            results.append(_record_result(index, "invalid_payload", key=key, message=f"Invalid JSON: {error}"))
            continue
        except Exception as error:  # Keep a bad object from failing the rest of the batch.
            logger.exception("Unable to read s3://%s/%s", bucket, key)
            results.append(_record_result(index, "processing_error", key=key, message=str(error)))
            continue

        validation_error = _validate_payload(payload)
        if validation_error:
            results.append(_record_result(index, "invalid_payload", key=key, message=validation_error))
            continue

        enriched = dict(payload)
        enriched["processed_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        enriched["source"] = _source_metadata(record, bucket, key)
        output_key = _processed_key(key)

        try:
            s3_client.put_object(
                Bucket=bucket,
                Key=output_key,
                Body=json.dumps(enriched, ensure_ascii=False, sort_keys=True).encode("utf-8"),
                ContentType="application/json",
            )
        except Exception as error:  # Keep processing other records after a write failure.
            logger.exception("Unable to write s3://%s/%s", bucket, output_key)
            results.append(_record_result(index, "processing_error", key=key, message=str(error)))
            continue

        results.append(_record_result(index, "processed", key=key, output_key=output_key))

    has_errors = any(result["status"] in {"invalid_event", "invalid_payload", "processing_error"} for result in results)
    status_code = 202 if deferred else 207 if has_errors else 200
    return {"statusCode": status_code, "results": results}