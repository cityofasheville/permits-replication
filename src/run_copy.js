// This function copies data from a source database to a target database.  

async function run_copy(source_client, target_client, select_string, insert_table, unique_columns) {
    let datarows = [];
    console.log(select_string)
    const { recordset } = await source_client.query(select_string);
    if(recordset.length === 0){
        return 0;
    }
    let columnnames = Object.keys(recordset[0]);
    let colchanges = columnnames
        .filter(col => !unique_columns.includes(col))
        .map(col => {
            return col + ' = excluded.' + col
        });
    let changes = colchanges.join(`,\n `);

    for (const record of recordset) { // Each new row
        datarows.push(`( ${Object.values(record).map(col => JSON.stringify(col, escaper)).join(',').replace(/"/g, "'")} )\n`);
    }
    let query_string = `INSERT INTO ${insert_table}(${columnnames.join(',')})  VALUES\n `;
    query_string += datarows.join(', ');
    query_string += ` on conflict(${unique_columns.join(',')}) do update set\n ${changes};`;
    // Insert new rows into target
    const { rowCount } = await target_client.query(query_string);
    return rowCount;
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

export default run_copy;
