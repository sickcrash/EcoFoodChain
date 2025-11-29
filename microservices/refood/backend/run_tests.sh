#!/bin/bash
# Script per eseguire test e generare report

# Crea directory per i risultati
mkdir -p test_results

echo "Avvio test suite Refood..."

# Verifica che il server sia in esecuzione
SERVER_RUNNING=$(netstat -tuln | grep 3000 || echo "")
if [ -z "$SERVER_RUNNING" ]; then
  echo "ATTENZIONE: Il server non sembra essere in esecuzione sulla porta 3000."
  echo "Per i test di integrazione e performance, avvia il server con 'npm run dev' in un altro terminale."
  echo "Continuiamo con i test unitari..."
fi

# 1. Test unitari
echo "Esecuzione test unitari..."
npx jest tests/unit --coverage --json --outputFile=test_results/unit-test-results.json

# Genera un report HTML basato sui risultati dei test unitari
npx jest tests/unit --coverage --coverageReporters=html --coverageDirectory=test_results/coverage

# 2. Test di integrazione (solo se richiesto - di default li escludiamo)
if [ "$1" = "--with-integration" ]; then
  echo "Esecuzione test di integrazione..."
  npx jest tests/integration --json --outputFile=test_results/integration-test-results.json
else
  echo "Test di integrazione saltati. Usa --with-integration per includerli."
fi

# Controlla se k6 è installato
if command -v k6 &> /dev/null; then
  # 3. Test di performance (solo se k6 è installato e il flag è impostato)
  if [ "$1" = "--with-performance" ] || [ "$2" = "--with-performance" ]; then
    echo "Esecuzione test di performance con k6..."
    k6 run tests/performance/simple-load-test.js --summary-export=test_results/performance-summary.json
  else
    echo "Test di performance saltati. Usa --with-performance per includerli."
  fi
else
  echo "k6 non è installato. I test di performance sono stati saltati."
  echo "Per installare k6: https://k6.io/docs/get-started/installation/"
fi

# Genera un semplice report riassuntivo in HTML
cat > test_results/summary.html << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Report Test Refood</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    .metrics { margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .success { color: green; }
    .failure { color: red; }
  </style>
</head>
<body>
  <h1>Report Test Refood</h1>
  <p>Generato il: $(date)</p>
  
  <h2>Sommario</h2>
  <p>Questo report contiene i risultati dei test eseguiti sull'applicazione Refood.</p>
  
  <h2>Test Unitari</h2>
  <div class="metrics">
EOF

# Estrai i risultati dei test unitari se esistono
if [ -f "test_results/unit-test-results.json" ]; then
  PASSED=$(cat test_results/unit-test-results.json | grep -o '"numPassedTests":[0-9]*' | cut -d':' -f2)
  FAILED=$(cat test_results/unit-test-results.json | grep -o '"numFailedTests":[0-9]*' | cut -d':' -f2)
  TOTAL=$(cat test_results/unit-test-results.json | grep -o '"numTotalTests":[0-9]*' | cut -d':' -f2)
  
  cat >> test_results/summary.html << EOF
    <table>
      <tr>
        <th>Test Totali</th>
        <th>Test Passati</th>
        <th>Test Falliti</th>
        <th>Percentuale di Successo</th>
      </tr>
      <tr>
        <td>${TOTAL:-0}</td>
        <td class="success">${PASSED:-0}</td>
        <td class="failure">${FAILED:-0}</td>
        <td class="success">$(( 100 * ${PASSED:-0} / (${TOTAL:-1} == 0 ? 1 : ${TOTAL:-1}) ))%</td>
      </tr>
    </table>
    
    <p>Per dettagli sulla copertura del codice, vedere la <a href="coverage/index.html">copertura dettagliata</a>.</p>
EOF
else
  cat >> test_results/summary.html << EOF
    <p>Nessun risultato disponibile per i test unitari.</p>
EOF
fi

cat >> test_results/summary.html << EOF
  </div>
  
  <h2>Test di Integrazione</h2>
  <div class="metrics">
EOF

# Estrai i risultati dei test di integrazione se esistono
if [ -f "test_results/integration-test-results.json" ]; then
  INT_PASSED=$(cat test_results/integration-test-results.json | grep -o '"numPassedTests":[0-9]*' | cut -d':' -f2)
  INT_FAILED=$(cat test_results/integration-test-results.json | grep -o '"numFailedTests":[0-9]*' | cut -d':' -f2)
  INT_TOTAL=$(cat test_results/integration-test-results.json | grep -o '"numTotalTests":[0-9]*' | cut -d':' -f2)
  
  cat >> test_results/summary.html << EOF
    <table>
      <tr>
        <th>Test Totali</th>
        <th>Test Passati</th>
        <th>Test Falliti</th>
        <th>Percentuale di Successo</th>
      </tr>
      <tr>
        <td>${INT_TOTAL:-0}</td>
        <td class="success">${INT_PASSED:-0}</td>
        <td class="failure">${INT_FAILED:-0}</td>
        <td class="success">$(( 100 * ${INT_PASSED:-0} / (${INT_TOTAL:-1} == 0 ? 1 : ${INT_TOTAL:-1}) ))%</td>
      </tr>
    </table>
EOF
else
  cat >> test_results/summary.html << EOF
    <p>Nessun test di integrazione eseguito.</p>
EOF
fi

cat >> test_results/summary.html << EOF
  </div>
  
  <h2>Test di Performance</h2>
  <div class="metrics">
EOF

# Estrai i risultati dei test di performance se esistono
if [ -f "test_results/performance-summary.json" ]; then
  cat >> test_results/summary.html << EOF
    <p>Test di performance eseguiti. Per visualizzare i risultati dettagliati, consulta il file JSON: <code>test_results/performance-summary.json</code></p>
EOF
else
  cat >> test_results/summary.html << EOF
    <p>Nessun test di performance eseguito.</p>
EOF
fi

cat >> test_results/summary.html << EOF
  </div>
  
  <h2>Conclusione</h2>
  <p>Questi test rappresentano una base per valutare la qualità e le prestazioni dell'applicazione Refood. 
  Si consiglia di eseguire i test regolarmente durante lo sviluppo per garantire la stabilità del codice.</p>
  
  <p>Report generato automaticamente. Per domande o problemi, contattare il team di sviluppo.</p>
</body>
</html>
EOF

echo "Test completati. Report disponibile in: test_results/summary.html"
echo "Puoi visualizzare i risultati aprendo questo file nel browser."

# Se ci sono test falliti, esci con un codice di errore
if [ "${FAILED:-0}" -gt 0 ] || [ "${INT_FAILED:-0}" -gt 0 ]; then
  echo "ATTENZIONE: Alcuni test sono falliti. Consulta il report per i dettagli."
  exit 1
fi

exit 0 