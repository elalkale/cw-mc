import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CW-MC API',
      version: '1.0.0',
      description: 'API para gestionar servidores de Minecraft',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Servidor local' },
    ],
  },

  // ✅ ruta REAL relativa a swagger.js
  apis: [path.join(__dirname, 'routes/*.js')],
};

export default swaggerJsdoc(options);