// Função para buscar o hash do bloco mais recente
export async function getLatestBlockHash(): Promise<string> {
  try {
    const response = await fetch('https://blockchain.info/latestblock')
    const data = await response.json()
    return data.hash
  } catch (error) {
    console.error('Erro ao buscar hash do bloco:', error)
    throw new Error('Não foi possível obter o hash do bloco mais recente')
  }
}

// Função para buscar informações de um bloco específico
export async function getBlockInfo(blockHash: string) {
  try {
    const response = await fetch(`https://blockchain.info/rawblock/${blockHash}`)
    const data = await response.json()
    return {
      hash: data.hash,
      height: data.height,
      time: new Date(data.time * 1000),
      previousBlock: data.prev_block,
      nextBlock: data.next_block,
      transactions: data.n_tx,
      size: data.size,
      weight: data.weight
    }
  } catch (error) {
    console.error('Erro ao buscar informações do bloco:', error)
    throw new Error('Não foi possível obter informações do bloco')
  }
}

// Função para verificar se um bloco é válido para sorteio
export function isBlockValidForRaffle(blockInfo: any): boolean {
  // Verifica se o bloco tem pelo menos 10 transações
  if (blockInfo.transactions < 10) return false
  
  // Verifica se o bloco tem pelo menos 10 minutos
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  if (blockInfo.time > tenMinutesAgo) return false
  
  return true
}

// Função para converter satoshis para BTC
export function satoshisToBTC(satoshis: number): number {
  return satoshis / 100000000
}

// Função para converter BTC para satoshis
export function btcToSatoshis(btc: number): number {
  return Math.floor(btc * 100000000)
}

// Função para formatar valor em BTC
export function formatBTC(btc: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8
  }).format(btc)
}

// Função para formatar valor em satoshis
export function formatSatoshis(satoshis: number): string {
  return new Intl.NumberFormat('en-US').format(satoshis)
}

// Função para validar endereço Bitcoin
export function isValidBitcoinAddress(address: string): boolean {
  // Regex básico para validar endereços Bitcoin
  const regex = {
    legacy: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    segwit: /^bc1[ac-hj-np-z02-9]{11,71}$/,
    lightning: /^ln[a-z0-9]{180,999}$/
  }

  return (
    regex.legacy.test(address) ||
    regex.segwit.test(address) ||
    regex.lightning.test(address)
  )
}

// Função para gerar QR code de pagamento Lightning
export async function generateLightningQR(invoice: string): Promise<string> {
  try {
    const response = await fetch('https://api.qrserver.com/v1/create-qr-code/', {
      method: 'POST',
      body: JSON.stringify({
        data: invoice,
        size: '300x300',
        format: 'svg'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) throw new Error('Erro ao gerar QR code')
    const qrCode = await response.text()
    return qrCode
  } catch (error) {
    console.error('Erro ao gerar QR code:', error)
    throw new Error('Não foi possível gerar o QR code')
  }
}

// Função para verificar status de uma transação Lightning
export async function checkLightningPayment(paymentHash: string): Promise<boolean> {
  try {
    // Aqui você implementaria a lógica para verificar o pagamento
    // usando sua própria infraestrutura Lightning
    return true
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error)
    return false
  }
}

// Função para verificar status de uma transação on-chain
export async function checkOnChainPayment(txid: string): Promise<boolean> {
  try {
    const response = await fetch(`https://blockchain.info/rawtx/${txid}`)
    const data = await response.json()
    
    // Verifica se a transação tem pelo menos 1 confirmação
    return data.block_height !== undefined
  } catch (error) {
    console.error('Erro ao verificar transação:', error)
    return false
  }
} 