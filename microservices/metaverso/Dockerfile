FROM nginx:alpine

# Imposta la directory di lavoro predefinita di Nginx
WORKDIR /usr/share/nginx/html

# Copia il file index principale
COPY index.html .

# Copia le cartelle della build Unity
# Nota: Assicurati che queste cartelle esistano nella stessa directory del Dockerfile
COPY Build/ ./Build/
COPY StreamingAssets/ ./StreamingAssets/
COPY TemplateData/ ./TemplateData/

# Espone la porta 80
EXPOSE 80