# ETL-Replication
Replicates changes to Accela "permits" view from SQL Server to Postgres. 

## Readme replication
The replication task is used for a "real-time" copy of all new rows in a table.

Run every (minute?)
Selects from source table everything with status_date = today
Program "upserts" each row into the target table.

### Technical challenges
It can't use ON CONFLICT clause to load the table because permit_num is not unique, 
so it takes longer to run than it should. (15 seconds)
Status_date is not a real timestamp column, it is used inconsistently in Accela, so this could miss some changes.
It is used in conjunction with a full nightly load.

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
