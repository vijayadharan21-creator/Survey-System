#!/bin/bash

mkdir -p server/{config,controllers,middleware,models,routes,services,utils}

touch server/{.env,.gitignore,app.js,server.js,package.json}
touch server/config/db.js

echo "Server folder structure created successfully!"