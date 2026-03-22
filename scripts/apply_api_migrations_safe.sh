#!/usr/bin/env bash
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$WEB_DIR/.." && pwd)"

resolve_api_dir() {
  local candidate=""

  if [[ -n "${API_DIR:-}" ]]; then
    printf '%s\n' "$API_DIR"
    return 0
  fi

  for candidate in \
    "$ROOT_DIR/api" \
    "$WEB_DIR/api" \
    "$PWD/api" \
    "$PWD/../api"
  do
    if [[ -f "$candidate/migrations/008_backfill_access_groups_from_legacy.php" || -f "$candidate/.env" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  printf '%s\n' "$ROOT_DIR/api"
}

API_DIR="$(resolve_api_dir)"
API_ENV_FILE="${API_ENV_FILE:-$API_DIR/.env}"

if [[ -f "$API_ENV_FILE" ]]; then
  while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    if [[ "$line" == *=* ]]; then
      key="${line%%=*}"
      value="${line#*=}"
      export "$key=$value"
    fi
  done < "$API_ENV_FILE"
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-topnotch}"
DB_USER="${DB_USER:-james}"
DB_PASS="${DB_PASS:-james123}"
DB_IMPORT_USER="${DB_IMPORT_USER:-}"

MYSQL_CMD=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME")

if [[ -n "$DB_IMPORT_USER" ]]; then
  MYSQL_CMD=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_IMPORT_USER" "$DB_NAME")
elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  if sudo mysql -e "USE \`${DB_NAME}\`;" >/dev/null 2>&1; then
    MYSQL_CMD=(sudo mysql "$DB_NAME")
  fi
fi

FAILED_STEPS=()

log() {
  printf '%s\n' "$*"
}

run_sql() {
  local label="$1"
  local sql="$2"
  local output=""

  log
  log "==> $label"
  if output=$(printf '%s\n' "$sql" | "${MYSQL_CMD[@]}" 2>&1); then
    [[ -n "$output" ]] && log "$output"
    log "OK: $label"
    return 0
  fi

  log "ERROR: $label"
  log "$output"
  FAILED_STEPS+=("$label")
  return 1
}

SQL_001=$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS promotions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_title VARCHAR(500) NOT NULL,
  description TEXT,
  start_date DATETIME,
  end_date DATETIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Draft',
  created_by INT DEFAULT NULL,
  assigned_to JSON DEFAULT NULL,
  target_platforms JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_promotions_status (status),
  INDEX idx_promotions_end_date (end_date),
  INDEX idx_promotions_created_by (created_by),
  INDEX idx_promotions_is_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_products (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  promo_price_aa DECIMAL(10, 2) DEFAULT NULL,
  promo_price_bb DECIMAL(10, 2) DEFAULT NULL,
  promo_price_cc DECIMAL(10, 2) DEFAULT NULL,
  promo_price_dd DECIMAL(10, 2) DEFAULT NULL,
  promo_price_vip1 DECIMAL(10, 2) DEFAULT NULL,
  promo_price_vip2 DECIMAL(10, 2) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_promotion_product (promotion_id, product_id),
  INDEX idx_promotion_products_promotion (promotion_id),
  INDEX idx_promotion_products_product (product_id),
  CONSTRAINT fk_promotion_products_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_postings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  platform_name VARCHAR(255) NOT NULL,
  posted_by INT DEFAULT NULL,
  post_url TEXT,
  screenshot_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Not Posted',
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  rejection_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promotion_postings_promotion (promotion_id),
  INDEX idx_promotion_postings_status (status),
  INDEX idx_promotion_postings_posted_by (posted_by),
  CONSTRAINT fk_promotion_postings_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL
)

SQL_002=$(cat <<'SQL'
SET @target_all_clients_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'promotions'
    AND COLUMN_NAME = 'target_all_clients'
);

SET @target_all_clients_sql := IF(
  @target_all_clients_exists = 0,
  "ALTER TABLE promotions ADD COLUMN target_all_clients TINYINT(1) NOT NULL DEFAULT 1",
  'SELECT 1'
);
PREPARE stmt FROM @target_all_clients_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @target_client_ids_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'promotions'
    AND COLUMN_NAME = 'target_client_ids'
);

SET @target_client_ids_sql := IF(
  @target_client_ids_exists = 0,
  "ALTER TABLE promotions ADD COLUMN target_client_ids JSON DEFAULT NULL",
  'SELECT 1'
);
PREPARE stmt FROM @target_client_ids_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @target_cities_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'promotions'
    AND COLUMN_NAME = 'target_cities'
);

SET @target_cities_sql := IF(
  @target_cities_exists = 0,
  "ALTER TABLE promotions ADD COLUMN target_cities JSON DEFAULT NULL",
  'SELECT 1'
);
PREPARE stmt FROM @target_cities_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @target_all_clients_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'promotions'
    AND INDEX_NAME = 'idx_promotions_target_all_clients'
);

SET @target_all_clients_index_sql := IF(
  @target_all_clients_index_exists = 0,
  'CREATE INDEX idx_promotions_target_all_clients ON promotions(target_all_clients)',
  'SELECT 1'
);
PREPARE stmt FROM @target_all_clients_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SQL
)

SQL_003=$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS ai_campaign_outreach (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  outreach_type ENUM('sms', 'call', 'chat') NOT NULL DEFAULT 'sms',
  status ENUM('pending', 'sent', 'delivered', 'failed', 'responded') NOT NULL DEFAULT 'pending',
  language ENUM('tagalog', 'english') NOT NULL DEFAULT 'tagalog',
  message_content TEXT,
  scheduled_at DATETIME DEFAULT NULL,
  sent_at DATETIME DEFAULT NULL,
  response_received TINYINT(1) NOT NULL DEFAULT 0,
  response_content TEXT,
  outcome ENUM('interested', 'not_interested', 'no_response', 'converted', 'escalated') DEFAULT NULL,
  conversation_id VARCHAR(255) DEFAULT NULL,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_campaign_outreach_campaign (campaign_id),
  INDEX idx_ai_campaign_outreach_client (client_id),
  INDEX idx_ai_campaign_outreach_status (status),
  INDEX idx_ai_campaign_outreach_scheduled (scheduled_at),
  CONSTRAINT fk_ai_campaign_outreach_campaign FOREIGN KEY (campaign_id) REFERENCES promotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_campaign_feedback (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  outreach_id INT DEFAULT NULL,
  client_id VARCHAR(255) DEFAULT NULL,
  feedback_type ENUM('objection', 'interest', 'question', 'conversion', 'complaint', 'positive') NOT NULL,
  content TEXT NOT NULL,
  sentiment ENUM('positive', 'neutral', 'negative') DEFAULT NULL,
  tags JSON DEFAULT NULL,
  ai_analysis JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_campaign_feedback_campaign (campaign_id),
  INDEX idx_ai_campaign_feedback_outreach (outreach_id),
  INDEX idx_ai_campaign_feedback_type (feedback_type),
  INDEX idx_ai_campaign_feedback_sentiment (sentiment),
  CONSTRAINT fk_ai_campaign_feedback_campaign FOREIGN KEY (campaign_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_campaign_feedback_outreach FOREIGN KEY (outreach_id) REFERENCES ai_campaign_outreach(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_message_templates (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  language ENUM('tagalog', 'english') NOT NULL DEFAULT 'tagalog',
  template_type VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables JSON DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_message_templates_language (language),
  INDEX idx_ai_message_templates_type (template_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ai_message_templates (name, language, template_type, content, variables) VALUES
('Tagalog Greeting', 'tagalog', 'greeting', 'Magandang araw po, {client_name}! Ito po si {agent_name} mula sa aming kumpanya.', JSON_ARRAY('client_name', 'agent_name')),
('Tagalog Promo Intro', 'tagalog', 'promo_intro', 'May magandang balita po kami para sa inyo! Kasalukuyang may promo ang {product_name} na may {discount_percentage}% discount. Gusto niyo po bang malaman ang detalye?', JSON_ARRAY('product_name', 'discount_percentage')),
('Tagalog Follow Up', 'tagalog', 'follow_up', 'Kumusta po? Follow up lang po sa aming pinag-usapan tungkol sa {product_name}. May tanong pa po ba kayo?', JSON_ARRAY('product_name')),
('Tagalog Closing', 'tagalog', 'closing', 'Maraming salamat po sa inyong oras! Kung may katanungan kayo, tawag o text lang po kayo anytime. Ingat po!', JSON_ARRAY()),
('English Greeting', 'english', 'greeting', 'Good day, {client_name}! This is {agent_name} from our company.', JSON_ARRAY('client_name', 'agent_name')),
('English Promo Intro', 'english', 'promo_intro', 'We have great news for you! {product_name} is currently on promotion with {discount_percentage}% off. Would you like to know more?', JSON_ARRAY('product_name', 'discount_percentage')),
('English Follow Up', 'english', 'follow_up', 'Hi there! Just following up on our conversation about {product_name}. Do you have any questions?', JSON_ARRAY('product_name')),
('English Closing', 'english', 'closing', 'Thank you for your time! If you have any questions, feel free to call or text us anytime. Take care!', JSON_ARRAY());
SQL
)

SQL_005=$(cat <<'SQL'
SET @table_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tblstock_adjustment'
);

SET @notes_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tblstock_adjustment'
    AND COLUMN_NAME = 'lnotes'
);

SET @notes_sql := IF(
  @table_exists = 1 AND @notes_exists = 0,
  "ALTER TABLE tblstock_adjustment ADD COLUMN lnotes TEXT NULL",
  'SELECT 1'
);
PREPARE notes_stmt FROM @notes_sql;
EXECUTE notes_stmt;
DEALLOCATE PREPARE notes_stmt;

SET @type_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tblstock_adjustment'
    AND COLUMN_NAME = 'ladjustment_type'
);

SET @type_sql := IF(
  @table_exists = 1 AND @type_exists = 0,
  "ALTER TABLE tblstock_adjustment ADD COLUMN ladjustment_type VARCHAR(50) NULL DEFAULT 'physical_count'",
  'SELECT 1'
);
PREPARE type_stmt FROM @type_sql;
EXECUTE type_stmt;
DEALLOCATE PREPARE type_stmt;
SQL
)

log "Using API dir: $API_DIR"
log "Using DB: $DB_NAME on $DB_HOST:$DB_PORT"

run_sql "001_create_promotions_tables" "$SQL_001" || true
run_sql "002_add_promotion_targeting" "$SQL_002" || true
run_sql "003_create_ai_campaign_tables" "$SQL_003" || true
run_sql "005_add_stock_adjustment_header_fields" "$SQL_005" || true
log
log "Skipping 004/006/007/008 because access control now uses legacy role tables directly."

log
if [[ ${#FAILED_STEPS[@]} -eq 0 ]]; then
  log "All API migrations completed."
  exit 0
fi

log "Completed with failures in:"
for step in "${FAILED_STEPS[@]}"; do
  log "  - $step"
done
exit 1
