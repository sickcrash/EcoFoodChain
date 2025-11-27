myapp/
├── src/
│   ├── appServer.js          # Express app configuration
│   ├── bootstrap.js          # Application initialization
│   ├── server.js            # Main entry point
│   ├── config/
│   │   └── env.js           # Environment configuration
│   ├── controller/
│   │   ├── batchController.js    # Batch request handlers
│   │   └── productController.js  # Product request handlers
│   ├── fabric/
│   │   ├── contract.js      # Chaincode interaction service
│   │   └── gateway.js       # Fabric Gateway management
│   └── routes/
│       ├── batchRoutes.js   # Batch API routes
│       └── productRoutes.js # Product API routes
├── Dockerfile
├── package.json
├── eslint.config.mjs
└── README.md