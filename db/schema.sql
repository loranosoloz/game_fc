-- game_fc — คลังสถิติแมตช์ (MySQL)
-- Runtime ของเกม Vite ใช้ IndexedDB ในเบราว์เซอร์
-- สคีมานี้สำหรับ sync / วิเคราะห์ / export ทีหลัง

CREATE DATABASE IF NOT EXISTS game_fc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE game_fc;

CREATE TABLE IF NOT EXISTS careers (
  id VARCHAR(64) PRIMARY KEY,
  manager_name VARCHAR(120) NOT NULL,
  human_club_id VARCHAR(64) NOT NULL,
  league_id VARCHAR(16) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_results (
  id VARCHAR(96) NOT NULL,
  career_id VARCHAR(64) NOT NULL,
  season SMALLINT NOT NULL,
  matchday SMALLINT NOT NULL,
  match_date VARCHAR(16) NOT NULL,
  competition VARCHAR(32) NOT NULL,
  cup_round VARCHAR(48) NULL,
  division TINYINT NULL,
  home_club_id VARCHAR(64) NOT NULL,
  away_club_id VARCHAR(64) NOT NULL,
  home_goals SMALLINT NOT NULL,
  away_goals SMALLINT NOT NULL,
  involves_human TINYINT(1) NOT NULL DEFAULT 0,
  home_rating DECIMAL(4, 2) NOT NULL,
  away_rating DECIMAL(4, 2) NOT NULL,
  mom_name VARCHAR(120) NULL,
  attendance INT NULL,
  penalties_home SMALLINT NULL,
  penalties_away SMALLINT NULL,
  went_extra TINYINT(1) NULL,
  top_ratings_json JSON NULL,
  PRIMARY KEY (career_id, id),
  KEY idx_md (career_id, season, matchday),
  KEY idx_human (career_id, involves_human),
  KEY idx_clubs (career_id, home_club_id, away_club_id),
  CONSTRAINT fk_match_career FOREIGN KEY (career_id) REFERENCES careers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_team_stats (
  career_id VARCHAR(64) NOT NULL,
  match_id VARCHAR(96) NOT NULL,
  side ENUM('home', 'away') NOT NULL,
  shots SMALLINT NOT NULL DEFAULT 0,
  shots_on_target SMALLINT NOT NULL DEFAULT 0,
  corners SMALLINT NOT NULL DEFAULT 0,
  fouls SMALLINT NOT NULL DEFAULT 0,
  yellows SMALLINT NOT NULL DEFAULT 0,
  reds SMALLINT NOT NULL DEFAULT 0,
  possession SMALLINT NOT NULL DEFAULT 50,
  xg DECIMAL(6, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (career_id, match_id, side),
  CONSTRAINT fk_stats_match FOREIGN KEY (career_id, match_id)
    REFERENCES match_results (career_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
