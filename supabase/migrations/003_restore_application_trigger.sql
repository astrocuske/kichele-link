BEGIN;

-- Restore the request-role helper used by the application integrity trigger.
CREATE OR REPLACE FUNCTION public.request_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claim.role', true),
        'anon'
    );
$$;

-- Restore application integrity enforcement.
CREATE OR REPLACE FUNCTION public.enforce_application_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_role text := public.request_role();
BEGIN
    -- Trusted server-side operations may bypass client-side restrictions.
    IF caller_role = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- The database, not the browser, determines the worker and status.
        NEW.worker_id := auth.uid();
        NEW.status := 'pending';

        -- An unauthenticated request must never create an application.
        IF NEW.worker_id IS NULL THEN
            RAISE EXCEPTION
                'Authentication is required to submit an application.'
                USING ERRCODE = '42501';
        END IF;

        -- Applications may only target open gigs.
        IF NOT EXISTS (
            SELECT 1
            FROM public.gigs AS g
            WHERE g.id = NEW.gig_id
              AND g.status = 'open'
        ) THEN
            RAISE EXCEPTION
                'Applications can only be submitted to open gigs.'
                USING ERRCODE = '23514';
        END IF;

        -- Limit application messages.
        IF NEW.message IS NOT NULL
           AND length(NEW.message) > 2000 THEN
            RAISE EXCEPTION
                'Application message must be 2000 characters or fewer.'
                USING ERRCODE = '22001';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Protect the application from changing its ownership,
        -- gig, message, or creation timestamp.
        IF OLD.gig_id IS DISTINCT FROM NEW.gig_id
           OR OLD.worker_id IS DISTINCT FROM NEW.worker_id
           OR OLD.message IS DISTINCT FROM NEW.message
           OR OLD.created_at IS DISTINCT FROM NEW.created_at
        THEN
            RAISE EXCEPTION
                'Only the application status can be updated.'
                USING ERRCODE = '23514';
        END IF;

        -- Only pending applications may transition.
        IF OLD.status IS DISTINCT FROM 'pending' THEN
            RAISE EXCEPTION
                'Only pending applications can be updated.'
                USING ERRCODE = '23514';
        END IF;

        -- Only accepted/rejected are valid client-side transitions.
        IF NEW.status NOT IN ('accepted', 'rejected') THEN
            RAISE EXCEPTION
                'Applications can only be set to accepted or rejected.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Do not allow clients to execute these security-definer functions directly.
REVOKE ALL ON FUNCTION public.request_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_application_rules() FROM PUBLIC;

-- Replace any existing application integrity trigger with the hardened version.
DROP TRIGGER IF EXISTS applications_enforce_rules
ON public.applications;

CREATE TRIGGER applications_enforce_rules
BEFORE INSERT OR UPDATE
ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_application_rules();

COMMIT;