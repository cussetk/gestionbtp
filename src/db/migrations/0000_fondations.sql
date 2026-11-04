-- Fondations communes à toutes les tables métier (voir docs/ARCHITECTURE.md).

-- Compteur global de versions de lignes : sert à la synchronisation hors-ligne
-- (« donne-moi tout ce qui a changé depuis la version N »).
CREATE SEQUENCE IF NOT EXISTS sync_seq;
--> statement-breakpoint

-- Trigger : met à jour updated_at et row_version à chaque modification d'une ligne métier.
CREATE OR REPLACE FUNCTION touch_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.row_version := nextval('sync_seq');
  RETURN NEW;
END $$;
--> statement-breakpoint

-- Trigger : met à jour updated_at (tables du socle, non synchronisées).
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint

-- Rôle sous lequel s'exécutent TOUTES les requêtes métier.
-- Il n'est pas propriétaire des tables : Postgres lui applique donc les règles d'isolation (RLS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT app_tenant TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_tenant;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE sync_seq TO app_tenant;
--> statement-breakpoint

-- Entreprise courante, posée au début de chaque transaction par withTenant().
-- Renvoie NULL si rien n'est posé → aucune ligne visible (sécurité par défaut).
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid
$$;
--> statement-breakpoint

-- Active l'isolation par entreprise sur une table métier (appelée par chaque module).
CREATE OR REPLACE FUNCTION enable_tenant_rls(tbl regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org())',
    tbl
  );
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO app_tenant', tbl);
  EXECUTE format('DROP TRIGGER IF EXISTS touch_row ON %s', tbl);
  EXECUTE format('CREATE TRIGGER touch_row BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION touch_row()', tbl);
END $$;
