/**
 * GOOGLE APPS SCRIPT — Controle de Pagamentos
 * =============================================
 * Lê dinamicamente as instituições (arquivos) e clientes (abas)
 * da pasta "Operacional Viana" no Google Drive.
 */

// ============================================================
// 1. CONFIGURAÇÃO
// ============================================================

const NOME_PASTA           = "Operacional Viana";
const COL_PARCELA          = "Parcelas";
const COL_DATA_RECEBIMENTO = "Data recebimento";
const COL_VALOR            = "Valor";
const COL_VALOR_PAGO       = "Valor pago";
const COL_SALDO_ACUMULADO  = "Saldo acumulado";

// ============================================================
// 2. doGet — endpoints de leitura
// ============================================================

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === "instituicoes") {
    return getInstituicoes();
  }

  if (action === "clientes") {
    const instituicao = e.parameter.instituicao;
    if (!instituicao) {
      return jsonResponse("error", "Parâmetro 'instituicao' ausente.");
    }
    return getClientes(instituicao);
  }

  if (action === "parcelas") {
    const instituicao = e.parameter.instituicao;
    const cliente     = e.parameter.cliente;
    if (!instituicao || !cliente) {
      return jsonResponse("error", "Parâmetros 'instituicao' e 'cliente' são obrigatórios.");
    }
    return getParcelasEmAberto(instituicao, cliente);
  }

  return jsonResponse("ok", "Apps Script ativo.");
}

// ============================================================
// 3. doPost — registra pagamento
// ============================================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { nome, instituicao, dataRecebimento, parcela, valorPago } = body;

    if (!nome || !instituicao || !dataRecebimento || !parcela || valorPago === undefined) {
      return jsonResponse("error", "Campos obrigatórios ausentes.");
    }

    const pasta = buscarPasta(NOME_PASTA);
    if (!pasta) {
      return jsonResponse("error", 'Pasta "' + NOME_PASTA + '" não encontrada.');
    }

    const arquivo = buscarArquivoNaPasta(pasta, instituicao);
    if (!arquivo) {
      return jsonResponse("error", 'Planilha "' + instituicao + '" não encontrada.');
    }

    const spreadsheet = SpreadsheetApp.open(arquivo);
    const sheet = buscarAba(spreadsheet, nome);
    if (!sheet) {
      return jsonResponse("error", 'Cliente "' + nome + '" não encontrado.');
    }

    const atualizado = atualizarParcela(sheet, parseInt(parcela, 10), dataRecebimento, parseFloat(valorPago));
    if (!atualizado) {
      return jsonResponse("error", 'Parcela ' + parcela + ' não encontrada.');
    }

    return jsonResponse("ok", 'Parcela ' + parcela + ' de ' + nome + ' atualizada com sucesso.');

  } catch (err) {
    Logger.log("ERRO: " + err.toString());
    return jsonResponse("error", "Erro interno: " + err.message);
  }
}

// ============================================================
// 4. ENDPOINTS DINÂMICOS
// ============================================================

function getInstituicoes() {
  try {
    const pasta = buscarPasta(NOME_PASTA);
    if (!pasta) {
      return jsonResponse("error", 'Pasta "' + NOME_PASTA + '" não encontrada.');
    }

    const arquivos = pasta.getFiles();
    const instituicoes = [];

    while (arquivos.hasNext()) {
      const arquivo = arquivos.next();
      const mime = arquivo.getMimeType();
      if (mime === "application/vnd.google-apps.spreadsheet") {
        instituicoes.push(arquivo.getName());
      }
    }

    instituicoes.sort();

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", data: instituicoes }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return jsonResponse("error", "Erro ao buscar instituições: " + err.message);
  }
}

function getClientes(instituicao) {
  try {
    const pasta = buscarPasta(NOME_PASTA);
    if (!pasta) {
      return jsonResponse("error", 'Pasta "' + NOME_PASTA + '" não encontrada.');
    }

    const arquivo = buscarArquivoNaPasta(pasta, instituicao);
    if (!arquivo) {
      return jsonResponse("error", 'Planilha "' + instituicao + '" não encontrada.');
    }

    const spreadsheet = SpreadsheetApp.open(arquivo);
    const abas = spreadsheet.getSheets();

    const ignorar = ["RESUMO", "CONFIG", "TOTAL", "BALANÇO"];
    const clientes = abas
      .map(s => s.getName())
      .filter(n => !ignorar.includes(n.trim().toUpperCase()))
      .sort();

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", data: clientes }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return jsonResponse("error", "Erro ao buscar clientes: " + err.message);
  }
}

function getParcelasEmAberto(instituicao, cliente) {
  try {
    const pasta = buscarPasta(NOME_PASTA);
    if (!pasta) {
      return jsonResponse("error", 'Pasta "' + NOME_PASTA + '" não encontrada.');
    }

    const arquivo = buscarArquivoNaPasta(pasta, instituicao);
    if (!arquivo) {
      return jsonResponse("error", 'Planilha "' + instituicao + '" não encontrada.');
    }

    const spreadsheet = SpreadsheetApp.open(arquivo);
    const sheet = buscarAba(spreadsheet, cliente);
    if (!sheet) {
      return jsonResponse("error", 'Cliente "' + cliente + '" não encontrado.');
    }

    const dados = sheet.getDataRange().getValues();

    // Encontra linha de cabeçalho
    var headerIndex = -1;
    for (var i = 0; i < dados.length; i++) {
      if (dados[i].some(function(c) {
        return String(c).trim() === COL_PARCELA;
      })) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return jsonResponse("error", 'Cabeçalho não encontrado.');
    }

    var cabecalho = dados[headerIndex];
    var idxParcela = -1;
    var idxValor   = -1;
    var idxData    = -1;

    for (var c = 0; c < cabecalho.length; c++) {
      var h = String(cabecalho[c]).trim();
      if (h === COL_PARCELA)          idxParcela = c;
      if (h === COL_VALOR)            idxValor   = c;
      if (h === COL_DATA_RECEBIMENTO) idxData    = c;
    }

    if (idxParcela < 0 || idxValor < 0 || idxData < 0) {
      return jsonResponse("error", 'Colunas obrigatórias não encontradas.');
    }

    var parcelas = [];
    for (var r = headerIndex + 1; r < dados.length; r++) {
      var row = dados[r];
      var numParcela = String(row[idxParcela] ?? '').trim();
      if (numParcela === '' || numParcela.toUpperCase() === 'TOTAL') continue;
      if (isNaN(parseFloat(numParcela))) continue;

      var dataRecebimento = String(row[idxData] ?? '').trim();
      if (dataRecebimento !== '') continue; // já foi pago, pula

      var valor = String(row[idxValor] ?? '').trim();

      parcelas.push({
        parcela: parseInt(numParcela, 10),
        valor: valor
      });
    }

    // Ordena pela parcela mais antiga primeiro
    parcelas.sort(function(a, b) { return a.parcela - b.parcela; });

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", data: parcelas }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return jsonResponse("error", "Erro ao buscar parcelas: " + err.message);
  }
}

// ============================================================
// 5. FUNÇÕES DE BUSCA NO DRIVE
// ============================================================

function buscarPasta(nomePasta) {
  const resultado = DriveApp.getFoldersByName(nomePasta);
  return resultado.hasNext() ? resultado.next() : null;
}

function buscarArquivoNaPasta(pasta, nomeArquivo) {
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (arquivo.getName() === nomeArquivo) return arquivo;
  }
  return null;
}

// ============================================================
// 6. BUSCA DA ABA DO CLIENTE
// ============================================================

function buscarAba(spreadsheet, nomeCliente) {
  const abas = spreadsheet.getSheets();
  const nomeBusca = nomeCliente.trim().toLowerCase();

  for (var i = 0; i < abas.length; i++) {
    if (abas[i].getName() === nomeCliente.trim()) return abas[i];
  }
  for (var j = 0; j < abas.length; j++) {
    if (abas[j].getName().trim().toLowerCase() === nomeBusca) return abas[j];
  }

  return null;
}

// ============================================================
// 7. ATUALIZAÇÃO DA PARCELA
// ============================================================

function atualizarParcela(sheet, numeroParcela, dataRecebimento, valorPago) {
  var dados = sheet.getDataRange().getValues();

  var headerIndex = -1;
  for (var i = 0; i < dados.length; i++) {
    if (dados[i].some(function(c) {
      return String(c).trim() === COL_PARCELA || String(c).trim() === "Parcela";
    })) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Cabeçalho não encontrado na aba "' + sheet.getName() + '".');
  }

  var cabecalho = dados[headerIndex];
  var idxParcela       = -1;
  var idxData          = -1;
  var idxValor         = -1;
  var idxValorPago     = -1;
  var idxSaldo         = -1;

  for (var c = 0; c < cabecalho.length; c++) {
    var h = String(cabecalho[c]).trim();
    if (h === COL_PARCELA || h === "Parcela") idxParcela   = c;
    if (h === COL_DATA_RECEBIMENTO)           idxData      = c;
    if (h === COL_VALOR)                      idxValor     = c;
    if (h === COL_VALOR_PAGO)                 idxValorPago = c;
    if (h === COL_SALDO_ACUMULADO)            idxSaldo     = c;
  }

  if (idxParcela < 0) throw new Error('Coluna "Parcelas" não encontrada.');
  if (idxData    < 0) throw new Error('Coluna "Data recebimento" não encontrada.');
  if (idxValor   < 0) throw new Error('Coluna "Valor" não encontrada.');

  for (var r = headerIndex + 1; r < dados.length; r++) {
    var celula = dados[r][idxParcela];
    if (celula === "" || celula === null) continue;
    if (isNaN(parseFloat(celula))) continue;

    if (parseInt(celula, 10) === numeroParcela) {

      // Grava data de recebimento
      sheet.getRange(r + 1, idxData + 1).setValue(formatarData(dataRecebimento));

      // Grava valor pago (coluna K)
      if (idxValorPago >= 0) {
        sheet.getRange(r + 1, idxValorPago + 1).setValue(valorPago);
      }

      // Calcula e grava saldo acumulado (coluna L)
      if (idxSaldo >= 0) {
        // Pega o valor devido desta parcela (remove R$, pontos e vírgulas)
        var valorDevido = parseMoeda(String(dados[r][idxValor] ?? '0'));

        // Busca saldo acumulado da parcela anterior (última linha com saldo preenchido antes desta)
        var saldoAnterior = 0;
        for (var prev = r - 1; prev >= headerIndex + 1; prev--) {
          var saldoPrev = dados[prev][idxSaldo];
          if (saldoPrev !== '' && saldoPrev !== null && !isNaN(parseFloat(saldoPrev))) {
            saldoAnterior = parseFloat(saldoPrev);
            break;
          }
        }

        var diferenca = valorPago - valorDevido;
        var novoSaldo = saldoAnterior + diferenca;

        sheet.getRange(r + 1, idxSaldo + 1).setValue(novoSaldo);
      }

      Logger.log("Parcela " + numeroParcela + " atualizada na linha " + (r + 1));
      return true;
    }
  }

  return false;
}

// ============================================================
// 8. UTILITÁRIOS
// ============================================================

function formatarData(isoDate) {
  var partes = isoDate.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function parseMoeda(str) {
  // Remove "R$", espaços, pontos de milhar e troca vírgula por ponto
  var limpo = str.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
  var val = parseFloat(limpo);
  return isNaN(val) ? 0 : val;
}

function jsonResponse(status, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: status, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}