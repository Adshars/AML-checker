import dotenv from 'dotenv';
import GatewayServer from './GatewayServer.js';

dotenv.config();

const PORT = process.env.PORT || 8080;

const gateway = new GatewayServer(PORT);
export const app = gateway.start();