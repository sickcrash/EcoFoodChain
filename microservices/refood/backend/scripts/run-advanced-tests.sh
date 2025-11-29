#!/bin/bash

# Script per eseguire i test di performance avanzati

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}      Test di Performance Avanzati per Refood       ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Funzione per verificare i prerequisiti
check_prerequisites() {
    echo -e "${YELLOW}Verifica dei prerequisiti...${NC}"
    
    # Controllo se k6 è installato
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Errore: k6 non è installato!${NC}"
        echo -e "Per installare k6, visita: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    # Controllo se il backend è in esecuzione
    if ! curl -s http://localhost:3000/api/v1/health >/dev/null; then
        echo -e "${RED}Errore: Il backend di Refood non sembra essere in esecuzione su http://localhost:3000${NC}"
        echo -e "Avvia il server prima di eseguire i test con 'npm run dev' o 'npm start'"
        exit 1
    fi
    
    echo -e "${GREEN}Tutti i prerequisiti sono soddisfatti!${NC}"
}

# Funzione per eseguire un singolo scenario di test
run_scenario() {
    local script=$1
    local scenario=$2
    local output_file="../../test_results/performance_${scenario}_$(date +%Y%m%d_%H%M%S).json"
    
    echo -e "${YELLOW}Esecuzione scenario: ${scenario}...${NC}"
    
    # Crea la directory per i risultati se non esiste
    mkdir -p ../../test_results
    
    # Esegui il test con k6 solo per lo scenario specifico
    k6 run --tag scenario=$scenario --out json=$output_file $script -e SCENARIO=$scenario
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Test completato con successo! Risultati salvati in: ${output_file}${NC}"
    else
        echo -e "${RED}Test fallito!${NC}"
    fi
}

# Funzione per eseguire tutti i test
run_all_tests() {
    echo -e "${YELLOW}Esecuzione di tutti gli scenari di test...${NC}"
    
    # Crea la directory per i risultati se non esiste
    mkdir -p ../../test_results
    
    # Esegui il test con k6
    k6 run advanced-load-test.js --out json=../../test_results/performance_complete_$(date +%Y%m%d_%H%M%S).json
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Tutti i test completati con successo!${NC}"
        echo -e "I report sono disponibili nella directory 'test_results/'"
    else
        echo -e "${RED}Test falliti!${NC}"
    fi
}

# Funzione per generare report completo
generate_report() {
    echo -e "${YELLOW}Generazione del report completo...${NC}"
    
    # Crea la directory per i risultati se non esiste
    mkdir -p ../../test_results
    
    # Esegui il test con k6 in modalità report
    k6 run --no-thresholds --no-summary advanced-load-test.js -o "output=../../test_results/summary.html"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Report generato con successo in 'test_results/summary.html'${NC}"
    else
        echo -e "${RED}Generazione del report fallita!${NC}"
    fi
}

# Menu principale
main() {
    check_prerequisites
    
    echo -e "${YELLOW}Seleziona un'opzione:${NC}"
    echo "1. Esegui tutti gli scenari di test"
    echo "2. Esegui solo il test di navigazione realistica"
    echo "3. Esegui solo il test di resistenza"
    echo "4. Esegui solo il test di picco di carico"
    echo "5. Esegui solo il test di stress sulle ricerche"
    echo "6. Esegui solo il test misto operatore/beneficiario"
    echo "7. Genera report completo"
    echo "0. Esci"
    
    read -p "Seleziona (0-7): " choice
    
    case $choice in
        1)
            run_all_tests
            ;;
        2)
            run_scenario "advanced-load-test.js" "realistic_journey"
            ;;
        3)
            run_scenario "advanced-load-test.js" "endurance"
            ;;
        4)
            run_scenario "advanced-load-test.js" "peak_load"
            ;;
        5)
            run_scenario "advanced-load-test.js" "search_stress"
            ;;
        6)
            run_scenario "advanced-load-test.js" "mixed_roles"
            ;;
        7)
            generate_report
            ;;
        0)
            echo -e "${GREEN}Uscita...${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Opzione non valida!${NC}"
            main
            ;;
    esac
}

# Esegui il menu principale
main 