import { sequelize} from 'sequelize';

const DB_HOST = process.env.DB_HOST || 'postgres';
const DB_USER = process.env.POSTGRES_USER || 'admin';
const DB_PASS = process.env.POSTGRES_PASSWORD || 'tajne_haslo_postgres';
const DB_NAME = process.env.POSTGRES_DB || 'core_db';

const sequelize = new sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    dialect: 'postgres',
    logging: false,
});

export default sequelize;