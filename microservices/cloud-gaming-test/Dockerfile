# Usa l'immagine base Nvidia con supporto OpenGL/Vulkan per il rendering offscreen
FROM nvidia/opengl:1.2-glvnd-runtime-ubuntu20.04

# Evita domande durante l'installazione
ENV DEBIAN_FRONTEND=noninteractive

# Installa le dipendenze necessarie a Unity per girare su Linux
RUN apt-get update && apt-get install -y \
    vulkan-tools \
    libglu1 \
    libxcursor1 \
    libxrandr2 \
    libxrender1 \
    libxi6 \
    libgconf-2-4 \
    libasound2 \
    pulseaudio \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# COPIA TUTTO quello che c'è nella cartella della build dentro il container
COPY . .

# Rendi eseguibile il file principale (sostituisci col TUO nome file se diverso)
RUN chmod +x progetto.x86_64

# Configura l'avvio:
# -batchmode: Niente finestra grafica (siamo in un server)
# -logfile: Butta i log sulla console di Docker così vediamo gli errori
ENTRYPOINT ["./progetto.x86_64", "-batchmode", "-logfile", "/dev/stdout"]