import pg from "pg";
const { Client } = pg;

async function get_pg_client(connection) {
    const client = new Client({
        host: connection.host,
        port: connection.port,
        user: connection.username,
        password: connection.password,
        database: connection.database,
        max: 10,
        idleTimeoutMillis: 10000,
    });
    await client.connect();
    return client;
}

export default get_pg_client;
