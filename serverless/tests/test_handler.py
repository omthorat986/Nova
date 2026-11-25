import json
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest


SERVERLESS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVERLESS_ROOT / "src"))

with patch("boto3.client"):
    import handler


class FakeContext:
    def __init__(self, remaining_ms=30_000):
        self.remaining_ms = remaining_ms

    def get_remaining_time_in_millis(self):
        return self.remaining_ms


def make_record(key="uploads/raw/observation-1.json", bucket="nova-observations"):
    return {
        "s3": {
            "bucket": {"name": bucket},
            "object": {"key": key.replace("/", "%2F"), "eTag": "abc123", "versionId": "v1"},
        }
    }


def valid_payload():
    return {
        "observation_id": "obs-001",
        "agency_or_channel": "General Space",
        "timestamp": "2026-11-25T10:00:00Z",
        "media_key": "uploads/media/image.jpg",
    }


@pytest.fixture(autouse=True)
def reset_s3_client():
    handler.s3_client = Mock()
    return handler.s3_client


def test_processes_valid_s3_event_and_writes_enriched_manifest(reset_s3_client):
    reset_s3_client.get_object.return_value = {
        "Body": Mock(read=Mock(return_value=json.dumps(valid_payload()).encode("utf-8")))
    }
    event = {"Records": [make_record()]}

    result = handler.lambda_handler(event, FakeContext())

    assert result["statusCode"] == 200
    assert result["results"] == [
        {
            "record": 0,
            "status": "processed",
            "key": "uploads/raw/observation-1.json",
            "output_key": "uploads/processed/observation-1.json",
        }
    ]
    reset_s3_client.get_object.assert_called_once_with(
        Bucket="nova-observations", Key="uploads/raw/observation-1.json"
    )
    written = json.loads(reset_s3_client.put_object.call_args.kwargs["Body"])
    assert written["observation_id"] == "obs-001"
    assert written["processed_at"].endswith("Z")
    assert written["source"] == {
        "bucket": "nova-observations",
        "key": "uploads/raw/observation-1.json",
        "etag": "abc123",
        "version_id": "v1",
    }
    assert reset_s3_client.put_object.call_args.kwargs["ContentType"] == "application/json"


@pytest.mark.parametrize(
    "payload",
    [
        {"observation_id": "obs-001"},
        {"observation_id": "", "agency_or_channel": "x", "timestamp": "now", "media_key": "key"},
        ["not", "an", "object"],
    ],
)
def test_validation_failures_are_reported_without_writing(reset_s3_client, payload):
    reset_s3_client.get_object.return_value = {"Body": Mock(read=Mock(return_value=json.dumps(payload).encode()))}

    result = handler.lambda_handler({"Records": [make_record()]}, FakeContext())

    assert result["statusCode"] == 207
    assert result["results"][0]["status"] == "invalid_payload"
    reset_s3_client.put_object.assert_not_called()


def test_invalid_json_does_not_crash_batch(reset_s3_client):
    reset_s3_client.get_object.side_effect = [
        {"Body": Mock(read=Mock(return_value=b"{broken json"))},
        {"Body": Mock(read=Mock(return_value=json.dumps(valid_payload()).encode()))},
    ]

    result = handler.lambda_handler(
        {"Records": [make_record(), make_record("uploads/raw/observation-2.json")]}, FakeContext()
    )

    assert result["statusCode"] == 207
    assert [item["status"] for item in result["results"]] == ["invalid_payload", "processed"]
    reset_s3_client.put_object.assert_called_once()


def test_processed_prefix_is_skipped_to_prevent_trigger_loop(reset_s3_client):
    result = handler.lambda_handler(
        {"Records": [make_record("uploads/processed/already.json")]}, FakeContext()
    )

    assert result["statusCode"] == 200
    assert result["results"][0]["status"] == "skipped"
    assert result["results"][0]["reason"] == "output_prefix"
    reset_s3_client.get_object.assert_not_called()
    reset_s3_client.put_object.assert_not_called()


def test_low_remaining_time_defers_current_and_remaining_records(reset_s3_client):
    context = FakeContext(remaining_ms=handler.TIMEOUT_BUFFER_SEC * 1000 - 1)

    result = handler.lambda_handler(
        {"Records": [make_record(), make_record("uploads/raw/observation-2.json")]}, context
    )

    assert result["statusCode"] == 202
    assert [item["status"] for item in result["results"]] == ["deferred", "deferred"]
    reset_s3_client.get_object.assert_not_called()
    reset_s3_client.put_object.assert_not_called()


def test_s3_read_error_is_recorded_and_later_records_continue(reset_s3_client):
    reset_s3_client.get_object.side_effect = [
        RuntimeError("read failed"),
        {"Body": Mock(read=Mock(return_value=json.dumps(valid_payload()).encode()))},
    ]

    result = handler.lambda_handler(
        {"Records": [make_record(), make_record("uploads/raw/observation-2.json")]}, FakeContext()
    )

    assert result["statusCode"] == 207
    assert [item["status"] for item in result["results"]] == ["processing_error", "processed"]
    reset_s3_client.put_object.assert_called_once()