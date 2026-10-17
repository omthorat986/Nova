-- Migration 005: Agency Channels Architecture & Communities Purge
-- Removes legacy community tables, adds General Space channel and metadata to agencies,
-- and links posts to agencies with high-performance indexes.

DROP TABLE IF EXISTS communities;
DROP TABLE IF EXISTS community_memberships;

-- Add agency channels columns
ALTER TABLE agencies ADD COLUMN slug TEXT;
ALTER TABLE agencies ADD COLUMN short_code TEXT;
ALTER TABLE agencies ADD COLUMN brand_initials TEXT;
ALTER TABLE agencies ADD COLUMN banner_gradient TEXT;
ALTER TABLE agencies ADD COLUMN description TEXT;

-- Update existing 8 agencies with channels metadata and verified URLs
UPDATE agencies SET
    slug = 'nasa',
    short_code = 'NASA',
    brand_initials = 'NASA',
    banner_gradient = 'linear-gradient(135deg, #0b3d91 0%, #1e1b4b 60%, #030712 100%)',
    description = 'United States civil space agency pioneering Earth science, the Artemis lunar campaign, Mars exploration, and astrophysics.'
WHERE code = 'NASA';

UPDATE agencies SET
    slug = 'esa',
    short_code = 'ESA',
    brand_initials = 'ESA',
    banner_gradient = 'linear-gradient(135deg, #003247 0%, #0f172a 60%, #030712 100%)',
    description = 'Intergovernmental gateway to space uniting European nations in Earth observation, science, navigation, and Ariane launcher systems.'
WHERE code = 'ESA';

UPDATE agencies SET
    slug = 'jaxa',
    short_code = 'JAXA',
    brand_initials = 'JAXA',
    banner_gradient = 'linear-gradient(135deg, #be123c 0%, #1e1b4b 60%, #030712 100%)',
    description = 'Pioneering asteroid sample return missions (Hayabusa), pinpoint lunar landings (SLIM), and international space station laboratory operations.'
WHERE code = 'JAXA';

UPDATE agencies SET
    slug = 'isro',
    short_code = 'ISRO',
    brand_initials = 'ISRO',
    banner_gradient = 'linear-gradient(135deg, #ea580c 0%, #1e293b 60%, #030712 100%)',
    description = 'National space agency advancing lunar exploration (Chandrayaan-3), solar research (Aditya-L1), and Gaganyaan human orbital flights.'
WHERE code = 'ISRO';

UPDATE agencies SET
    slug = 'cnsa',
    short_code = 'CNSA',
    brand_initials = 'CNSA',
    banner_gradient = 'linear-gradient(135deg, #b91c1c 0%, #1c1917 60%, #030712 100%)',
    description = 'National space administration managing the permanent Tiangong space station, Chang''e lunar exploration, and interplanetary Tianwen missions.'
WHERE code = 'CNSA';

UPDATE agencies SET
    slug = 'roscosmos',
    short_code = 'ROS',
    brand_initials = 'ROS',
    banner_gradient = 'linear-gradient(135deg, #1d4ed8 0%, #701a75 60%, #030712 100%)',
    description = 'Government corporation overseeing Russian civil rocketry, the Soyuz human spaceflight system, orbital science, and spaceport infrastructure.'
WHERE code = 'ROSCOSMOS';

UPDATE agencies SET
    slug = 'csa',
    short_code = 'CSA',
    brand_initials = 'CSA',
    banner_gradient = 'linear-gradient(135deg, #dc2626 0%, #1e293b 60%, #030712 100%)',
    description = 'Advancing space robotics (Canadarm2, Canadarm3 for Gateway), satellite radar observation (RADARSAT), and deep space astrophysics.'
WHERE code = 'CSA';

UPDATE agencies SET
    slug = 'uaesa',
    short_code = 'UAESA',
    brand_initials = 'UAE',
    banner_gradient = 'linear-gradient(135deg, #059669 0%, #1e293b 60%, #030712 100%)',
    description = 'Directing national space policy, the Emirates Mars Mission (Hope Probe) atmospheric study, and the upcoming mission to the Asteroid Belt.'
WHERE code = 'UAESA';

-- Insert General Space channel
INSERT OR IGNORE INTO agencies (code, slug, short_code, name, brand_initials, banner_gradient, description, short_description, country, website_url, contact_url, logo_initials)
VALUES (
    'GEN',
    'general',
    'GEN',
    'General Space',
    'GEN',
    'linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%)',
    'Open celestial channel for general astronomy, astrophysics, planetary discoveries, deep-space surveys, and observations not bound to a national agency.',
    'Open celestial channel for general astronomy, astrophysics, planetary discoveries, and observations not bound to a national agency.',
    'Global / Orbital',
    'https://www.iau.org',
    'https://www.iau.org/administration/secretariat/',
    'GEN'
);

-- Link posts to agency_id
ALTER TABLE posts ADD COLUMN agency_id INTEGER REFERENCES agencies(id);

-- Assign any unassigned posts to General Space
UPDATE posts SET agency_id = (SELECT id FROM agencies WHERE slug = 'general') WHERE agency_id IS NULL;

-- High performance indexing
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug);
CREATE INDEX IF NOT EXISTS idx_posts_agency_created ON posts(agency_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_follows_pair ON agency_follows(user_id, agency_id);
