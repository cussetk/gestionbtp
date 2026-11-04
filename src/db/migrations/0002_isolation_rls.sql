-- Isolation stricte par entreprise sur les tables métier du module 1.
SELECT enable_tenant_rls('clients');
--> statement-breakpoint
SELECT enable_tenant_rls('sites');
--> statement-breakpoint

-- L'entreprise peut lire et modifier SA fiche (paramètres), et seulement la sienne.
-- Pas de FORCE ici : la connexion (avant de connaître l'entreprise) lit cette table en tant que propriétaire.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY own_org ON organizations USING (id = app_current_org()) WITH CHECK (id = app_current_org());
--> statement-breakpoint
GRANT SELECT, UPDATE ON organizations TO app_tenant;
--> statement-breakpoint

-- Horodatage automatique des tables du socle.
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
