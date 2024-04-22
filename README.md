# Permit-Replication
Replicates changes to Accela "permits" view from SQL Server to Postgres. 
Copies 3 tables (permits, permit_comments, and permit_contractors) and reloads two materialized views.
(See _What is a materialized view?_ below.)

## Readme replication
The replication task is used for a "real-time" copy of all new rows in a table.

Run every (15 minutes?)
Selects from source table everything with status_date = today
Program "upserts" each row into the target table.

### Technical challenges
It can't use ON CONFLICT clause to load the table because permit_num is not unique, 
so it takes longer to run than it should. (15 seconds)
Permits.status_date is not a real timestamp column, it is used inconsistently in Accela, so this could miss some changes.
This process is used in conjunction with a full nightly reload.

## These are the only rows from permits table needing to be realtime
SELECT DISTINCT
A.permit_num, A.permit_group, A.permit_type, A.permit_subtype, A.permit_category, 
A.permit_description, A.applicant_name, applied_date, A.status_current, 
status_date, A.technical_contact_name, A.technical_contact_email,
A.created_by, A.building_value, A.job_value, A.total_project_valuation, A.total_sq_feet, 
A.fees, A.paid, A.balance, A.invoiced_fee_total, A.civic_address_id, A.site_address, A.internal_record_id
FROM amd.permits A
WHERE A.permit_num not like '%TMP%' 
and cast (status_date as date) = cast (GETDATE() as date)
order by A.status_date desc;


### What is a materialized view?
These are used to precalculate some of the more pathological queries.

These are like tables in a database, except that you can't insert, update, etc. 
When you create them, it's like a snapshot view of the base tables.
    create materialized view materialized_view_name as
    select * from basetables;

You reload the data with the command:
    refresh materialized view concurrently simplicity.materialized_view_name;