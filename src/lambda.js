import get_pg_client from './get_pg_client.js';
import get_ss_client from './get_ss_client.js';
import getConnection from './getConnection.js';

export async function handler (event, context) {
    try {
        let insert_count = 0;
        let update_count = 0;
        const accela_connection = await getConnection('coa-acceladb/accela/mssqlgisadmin');
        const library_connection = await getConnection('pubrecdb1/mdastore1/dbadmin');

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
        let insert_header = `INSERT INTO internal.permits_temp(${ columnnames.join(',')})  VALUES `;
        let update_header = `UPDATE internal.permits_temp SET `;
        let query_string;
        for (const record of recordset) { // Each new row
            const sel_query = `SELECT * FROM internal.permits_temp WHERE permit_num = '${record.permit_num}'`;
            const { rowCount } = await target_client.query(sel_query);
            if (rowCount > 0) { // Already exists, so update
                query_string = update_header;
                let colchanges = columnnames.map(col => {
                    return col + ' = ' + JSON.stringify(record[col], escaper).replace(/"/g, "'")
                })
                query_string += colchanges.join(', ');
                query_string += ` where permit_num = '${record.permit_num}'`;
                // console.log(query_string);
                const { rowCount } = await target_client.query(query_string);
                update_count += rowCount;
            } else { // New row, so insert
                query_string = `${insert_header}( ${Object.values(record).map(col => JSON.stringify(col, escaper)).join(',').replace(/"/g, "'")} )`;
                // console.log(query_string);
                const { rowCount } = await target_client.query(query_string);
                insert_count += rowCount;
            }
        }

        await target_client.end();
        await source_client.close();
        console.log(`Inserted ${insert_count} rows and updated ${update_count} rows.`);
        return ({
            'statusCode': 200,
            'body': {
                "lambda_output": {
                    "insert_results": insert_count,
                    "update_results": update_count
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