import get_pg_client from './get_pg_client.js';
import get_ss_client from './get_ss_client.js';
import getConnection from './getConnection.js';
import run_copy from './run_copy.js';

export async function handler(event, context) {
    let source_client;
    let target_client;
    try {
        const accela_connection = await getConnection('coa-acceladb/accela/mssqlgisadmin');
        const library_connection = await getConnection('pubrecdb1/mdastore1/dbadmin');
        if (event.local) {
            accela_connection.host = 'localhost';
            library_connection.host = 'localhost';
        }
        source_client = await get_ss_client(accela_connection);
        target_client = await get_pg_client(library_connection);

        // Permits have to pull for the whole day because of Accela's inconsentent use of status_date.
        // Comments and contractors pull since last run (15 minutes).
        let tables = [
            {
                insert_table: 'internal.permits',
                unique_columns: ['permit_num'],
                select_string: `
                SELECT DISTINCT
                A.permit_num, A.permit_group, A.permit_type, A.permit_subtype, A.permit_category, 
                A.permit_description, A.applicant_name, applied_date, A.status_current, 
                status_date, A.technical_contact_name, A.technical_contact_email,
                A.created_by, A.building_value, A.job_value, A.total_project_valuation, A.total_sq_feet, 
                A.fees, A.paid, A.balance, A.invoiced_fee_total, A.civic_address_id, A.site_address, A.internal_record_id
                FROM amd.permits A
                WHERE A.permit_num not like '%TMP%' 
                and cast(status_date as date) = cast(GETDATE() as date); 
            `},
            {
                insert_table: 'internal.permit_comments',
                unique_columns: ['permit_num', 'comment_seq_number'],
                select_string: `
                select * from amd.permit_comments
                where comment_date between DATEADD(MINUTE,-16,GETDATE()) and GETDATE();
            `},
            {
                insert_table: 'internal.permit_contractors',
                unique_columns: ['permit_num', 'contractor_license_number', 'license_type'],
                select_string: `
                select * from amd.permit_contractors
                where record_date between DATEADD(MINUTE,-16,GETDATE()) and GETDATE();
            `}
        ];
        for (let i = 0; i < tables.length; i++) {
            tables[i].rowCount = await run_copy(source_client, target_client,
                tables[i].select_string, tables[i].insert_table, tables[i].unique_columns);
        }
        let results = tables.map(table => {
            return {
                table: table.insert_table,
                rows_updated: table.rowCount
            }
        });
        // Now rebuild the materialized view
        await target_client.query('refresh materialized view concurrently simplicity.m_v_simplicity_permits;');
        results.push({ materialized_view: 'simplicity.m_v_simplicity_permits' });
        console.log("Results",results);
        return ({
            'statusCode': 200,
            'body': {
                "lambda_output": {
                    "results": results
                }
            }
        })
    } catch (err) {
        return (returnError(err))
    } finally {
        await target_client.end();
        await source_client.close();
    }
}

function returnError(err) {
    return {
        'statusCode': 500,
        'body': {
            "lambda_output": err.toString()
        }
    }
}