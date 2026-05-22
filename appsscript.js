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

  return jsonResponse("ok", "Apps Script ativo.");
}

// ============================================================
// 3. doPost — registra pagamento
// ============================================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { nome, instituicao, dataRecebimento, parcela } = body;

    if (!nome || !instituicao || !dataRecebimento || !parcela) {
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

    const atualizado = atualizarParcela(sheet, parseInt(parcela, 10), dataRecebimento);
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

function atualizarParcela(sheet, numeroParcela, dataRecebimento) {
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
  var idxParcela = -1;
  var idxData    = -1;

  for (var c = 0; c < cabecalho.length; c++) {
    var h = String(cabecalho[c]).trim();
    if (h === COL_PARCELA || h === "Parcela") idxParcela = c;
    if (h === COL_DATA_RECEBIMENTO)           idxData    = c;
  }

  if (idxParcela < 0) throw new Error('Coluna "Parcelas" não encontrada.');
  if (idxData    < 0) throw new Error('Coluna "Data recebimento" não encontrada.');

  for (var r = headerIndex + 1; r < dados.length; r++) {
    var celula = dados[r][idxParcela];
    if (celula === "" || celula === null) continue;
    if (isNaN(parseFloat(celula))) continue;

    if (parseInt(celula, 10) === numeroParcela) {
      sheet.getRange(r + 1, idxData + 1).setValue(formatarData(dataRecebimento));
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

function jsonResponse(status, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: status, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}