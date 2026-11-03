-- Label scopes: customer | project | marketing | product

ALTER TABLE business_tags ADD COLUMN IF NOT EXISTS scope varchar(24) NOT NULL DEFAULT 'customer';

DROP INDEX IF EXISTS business_tags_biz_name_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS business_tags_biz_scope_name_uidx
  ON business_tags (business_id, scope, name);
