const http              = require('http');
const express           = require('express');
const cors              = require('cors');
const swaggerUi         = require('swagger-ui-express');
const app               = express();

module.exports = class UserServer {
    constructor({config, managers}){
        this.config        = config;
        this.userApi       = managers.userApi;
        this.docs          = managers.docs;
    }
    
    /** for injecting middlewares */
    use(args){
        app.use(args);
    }

    /** server configs */
    run(){
        app.use(cors({origin: '*'}));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true}));
        app.use('/static', express.static('public'));

        /** api docs */
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(this.docs.spec));
        app.get('/api-docs.json', (req, res) => res.json(this.docs.spec));

        /** a single middleware to handle all */
        app.all('/api/:moduleName/:fnName', this.userApi.mw);

        /** 404 — no route matched */
        app.use((req, res) => {
            res.status(404).json({ ok: false, message: `${req.method} ${req.path} not found` });
        });

        /** 500 — unhandled error */
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({ ok: false, message: 'internal_server_error' });
        });

        let server = http.createServer(app);
        server.listen(this.config.dotEnv.USER_PORT, () => {
            console.log(`${(this.config.dotEnv.SERVICE_NAME).toUpperCase()} is running on port: ${this.config.dotEnv.USER_PORT}`);
        });
    }
}