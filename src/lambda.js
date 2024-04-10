import get_pg_client from './get_pg_client.js';
import get_ss_client from './get_ss_client.js';
import getConnection from './getConnection.js';

export async function handler(event, context) {
    try {
        let insert_count = 0;
        let update_count = 0;
        let datarows = [];
        const accela_connection = await getConnection('coa-acceladb/accela/mssqlgisadmin');
        const library_connection = await getConnection('pubrecdb1/mdastore1/dbadmin');
        if (event.local) {
            accela_connection.host = 'localhost';
            library_connection.host = 'localhost';
        }
        const source_client = await get_ss_client(accela_connection);
        const target_client = await get_pg_client(library_connection);

        // Get all new rows from source
        const { recordset } = await source_client.query(`
            SELECT DISTINCT
            A.permit_num, A.permit_group, A.permit_type, A.permit_subtype, A.permit_category, 
            A.permit_description, A.applicant_name, applied_date, A.status_current, 
            status_date, A.technical_contact_name, A.technical_contact_email,
            A.created_by, A.building_value, A.job_value, A.total_project_valuation, A.total_sq_feet, 
            A.fees, A.paid, A.balance, A.invoiced_fee_total, A.civic_address_id, A.site_address, A.internal_record_id
            FROM amd.permits A
            WHERE A.permit_num not like '%TMP%' 
            and cast(status_date as date) = cast(GETDATE() as date)
            order by A.status_date desc; 
            `);

        let columnnames = Object.keys(recordset[0]);
        let colchanges = columnnames
            .filter(col => col !== 'permit_num')
            .map(col => {
                return col + ' = excluded.' + col
            });
        let changes = colchanges.join(`,\n `);

        for (const record of recordset) { // Each new row
            datarows.push(`( ${Object.values(record).map(col => JSON.stringify(col, escaper)).join(',').replace(/"/g, "'")} )\n`);
        }
        let query_string = `INSERT INTO internal.permits(${columnnames.join(',')})  VALUES\n `;
        query_string += datarows.join(', ');
        query_string += ` on conflict(permit_num) do update set\n ${changes};`;

        // console.log(query_string);
        const { rowCount } = await target_client.query(query_string);
        await target_client.query('refresh materialized view concurrently simplicity.m_v_simplicity_permits;');

        await target_client.end();
        await source_client.close();
        console.log(`Updated ${rowCount} rows.`);
        return ({
            'statusCode': 200,
            'body': {
                "lambda_output": {
                    "rows_updated": rowCount
                }
            }
        })
    } catch (err) {
        return (returnError(err))
    }
}

function escaper(key, value) {
    // JSON.stringify replacer function called on every data item. Escapes quotes in strings.
    if (typeof value === 'number') {
        return value
    } else if (!value) {
        return null
    } else {
        return value.replace(/'|"/g, "''")
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