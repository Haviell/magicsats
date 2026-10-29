// @ts-nocheck -- ported as-is from the original MagicSats code

/**
 * ⚠️ IMPORTANTE - ROUND #0 É ARQUIVO HISTÓRICO ⚠️
 *
 * O Round #0 deve ser mantido EXATAMENTE como está para preservar credibilidade social.
 *
 * Características ÚNICAS do Round #0 (NÃO alterar):
 * - Valores: 0.00044000 BTC total (44.000 sats)
 * - Múltiplos prêmios: 1º lugar (0.00040000 BTC) + 2º lugar (0.00004000 BTC)
 * - SEM informação de "valor por número"
 * - Função: Arquivo histórico para credibilidade
 *
 * Rounds 1+: Template global para estratégia mundial
 * - Prêmio único: 0.00080000 BTC (80.000 sats)
 * - COM informação de "valor por número": 0.00001000 BTC cada
 * - Função: Base escalável para captação global de Bitcoin
 */

import { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ListOrdered, Share2, Users, Bitcoin, ChevronLeft, ChevronRight, Factory, Shield, HelpCircle, Settings, BarChart2, X, Scale, Copy, RotateCcw, Lock, Hash, Fingerprint, Scroll, Timer, Trophy, LogIn, Lightbulb, Wallet, ArrowDown, ArrowUpRight, Check, AlertTriangle, Eye, EyeOff, Bell, BellOff, Moon, Sun, Globe, Smartphone, Filter, Search, QrCode, Mail, User, ArrowLeft, ArrowRight, Star, Info, Zap, ShieldCheck, Gift, Send, Key, CheckCircle2 } from "lucide-react"
import { useRouter, useSearchParams } from '@/lib/next-compat'
import { useToast } from '@/hooks/use-toast'
import { initializeRoundZero } from '@/lib/raffle'
import type { RaffleRound, RaffleNumber } from '@/types/raffle'
import { useAuth } from '@/hooks/use-auth'
import { useSupabaseData } from '@/hooks/use-supabase-data'
import { supabase } from '@/integrations/supabase/client'
import { useRoundAccess, getRoundAccess } from '@/hooks/use-round-access'
import { unsubscribeFromMarketing } from '@/lib/email.functions'
import type { LuckyNumber } from '@/lib/lucky-numbers'

async function loadRoundFromDatabase(roundNumber: number, allowPreview = false) {
  const { data: raffle, error: raffleError } = await supabase
    .from('raffles')
    .select('id, round_number, total_prize, ticket_price, status, created_at')
    .eq('round_number', roundNumber)
    .maybeSingle()

  if (raffleError) throw new Error('Não foi possível carregar os dados da rifa.')
  if (!raffle && !allowPreview) throw new Error('Esta rodada ainda não foi criada.')

  const [{ data: soldNumbers, error: soldError }, { data: winners, error: winnersError }] =
    await Promise.all([
      supabase.rpc('get_sold_numbers', { target_round: roundNumber }),
      supabase.rpc('get_public_winners'),
    ])
  if (soldError || winnersError) throw new Error('Não foi possível carregar os números da rifa.')

  const sold = new Set(soldNumbers ?? [])
  const roundWinners = (winners ?? [])
    .filter((winner) => winner.round_number === roundNumber)
    .map((winner) => ({ name: winner.nickname_masked, address: '' }))
  const isLegacy = roundNumber === 0
  const legacyRound = isLegacy ? initializeRoundZero() : null
  const totalPrize = raffle ? Number(raffle.total_prize) : 0.0008
  const ticketPrice = raffle ? Number(raffle.ticket_price) : 0.00001

  return {
    ...(legacyRound ?? {}),
    id: raffle ? String(raffle.id) : `round-${roundNumber}`,
    roundNumber,
    totalNumbers: 99,
    prizePool: totalPrize,
    ticketPrice,
    drawDate: raffle ? new Date(raffle.created_at) : new Date(),
    status: raffle?.status ?? 'upcoming',
    isUpcoming: raffle?.status === 'upcoming' || !raffle,
    numbers: Array.from({ length: 99 }, (_, index) => ({
      number: index + 1,
      status: sold.has(index + 1) ? 'sold' as const : 'available' as const,
      purchasedAt: null,
      purchasedBy: null,
    })),
    winners: roundWinners,
    createdAt: raffle ? new Date(raffle.created_at) : new Date(),
    updatedAt: raffle ? new Date(raffle.created_at) : new Date(),
  }
}

// Mova os componentes de cards para dentro do arquivo
const VisitorsCard = ({ visitors }: { visitors: { today: number; total: number } }) => (
  <div className="bg-gradient-to-b from-white to-gray-100 p-2.5 rounded-xl
    border-[4px] border-black
    shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
    hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
    hover:translate-y-[2px]
    active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
    active:translate-y-[6px]
    relative overflow-hidden group
    transition-all duration-200"
  >
    <div className="flex items-center gap-1.5 mb-1.5">
      <Users className="h-3.5 w-3.5 text-black group-hover:scale-110 transition-transform" />
      <span className="text-xs font-medium">Visitantes</span>
    </div>
    <div className="grid grid-cols-2 gap-1">
      <div className="text-[10px] bg-white p-1 rounded-lg
        border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
        hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
        hover:translate-y-[1px]
        transition-all">
        <div className="text-black/70">Hoje</div>
        <div className="font-medium">{visitors.today}</div>
      </div>
      <div className="text-[10px] bg-white p-1 rounded-lg
        border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
        hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
        hover:translate-y-[1px]
        transition-all">
        <div className="text-black/70">Total</div>
        <div className="font-medium">{visitors.total}</div>
      </div>
    </div>
  </div>
);

const BitcoinCard = ({
  btcPrice,
  calculateBRLValue,
  priceChangeDirection
}: {
  btcPrice: number;
  calculateBRLValue: (amount: number) => string;
  priceChangeDirection: 'up' | 'down' | null;
}) => (
  <div className="bg-gradient-to-b from-[#f7931a] to-[#e68a00] p-3 rounded-xl
    border-[4px] border-black
    shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
    hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
    hover:translate-y-[2px]
    active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
    active:translate-y-[6px]
    relative overflow-hidden group
    transition-all duration-200"
  >
    <div className="flex items-center gap-2 mb-2">
      <Bitcoin className="h-4 w-4 text-white group-hover:scale-110 transition-transform" />
      <span className="text-sm font-medium text-white">Bitcoin</span>
    </div>
    <div className="text-xs bg-white/95 backdrop-blur-sm p-2 rounded-lg
      border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
      hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
      hover:translate-y-[1px]
      transition-all"
    >
      <div className="flex justify-between mb-1">
        <span className="text-black/70">BTC</span>
        <span className={`font-medium transition-all duration-300 ${
          priceChangeDirection === 'up' ? 'text-green-500 font-bold' :
          priceChangeDirection === 'down' ? 'text-red-500 font-bold' :
          'text-[#f7931a]'
        }`}>
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(btcPrice)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-black/70">1 Sat</span>
        <span className={`font-medium transition-all duration-300 ${
          priceChangeDirection === 'up' ? 'text-green-500 font-bold' :
          priceChangeDirection === 'down' ? 'text-red-500 font-bold' :
          'text-[#f7931a]'
        }`}>
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 6,
            maximumFractionDigits: 6
          }).format(btcPrice / 100000000)}
        </span>
      </div>
    </div>

    {/* Efeito de brilho */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
      opacity-0 group-hover:opacity-100 transition-opacity duration-500
      animate-[shine_2s_ease-in-out_infinite]"
    />

    {/* Símbolo do Bitcoin em background */}
    <div className="absolute -right-4 -bottom-4 text-[80px] text-white/10 transform rotate-12 pointer-events-none">
      ₿
    </div>
  </div>
);
// Dashboard do usuário com saldo - Preparado para o Backend
interface UserDashboardProps {
  calculateBRLValue: (amount: number) => string;
  btcPrice: number;
  isLoggedIn: boolean;
  userName?: string;
  userBalance?: number;
  inGameBalance?: number;
  availableToWithdraw?: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTip: () => void;
  onSettings: () => void;
}

const UserDashboard = ({
  calculateBRLValue,
  btcPrice,
  isLoggedIn,
  userName = 'Visitante',
  userBalance = 0,
  inGameBalance = 0,
  availableToWithdraw = 0,
  onSettings,
}: UserDashboardProps) => {
  const currentBalanceBRL = calculateBRLValue(userBalance);
  const userBalanceSats = Math.round(userBalance * 100000000);
  const inGameBalanceSats = Math.round(inGameBalance * 100000000);
  const availableToWithdrawSats = Math.round(availableToWithdraw * 100000000);

  return (
    <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-black p-5 rounded-2xl
      border-[3px] border-black
      shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
      relative overflow-hidden
      transition-all text-white"
    >
      {/* Efeito Glow Laranja Bitcoin */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-500/20 blur-[50px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full pointer-events-none" />

      {/* Header do Usuário */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg border-2 border-white/20">
            <span className="font-extrabold text-lg text-white">
              {isLoggedIn ? userName.charAt(0).toUpperCase() : '⚡'}
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-100 tracking-tight">
                {isLoggedIn ? `@${userName}` : 'Visitante'}
              </span>
              {isLoggedIn && (
                <ShieldCheck className="w-4 h-4 text-emerald-400" title="Perfil Anônimo e Protegido" />
              )}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase flex items-center gap-1">
              {isLoggedIn ? '🛡️ Conta Anônima' : 'Modo Visitante'}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettings}
          className="w-9 h-9 hover:bg-white/10 rounded-xl transition-all"
        >
          <Settings className="w-5 h-5 text-gray-400 hover:text-white" />
        </Button>
      </div>

      {/* Card de Saldo com Satoshis e BTC */}
      <div className="mb-5 space-y-3 relative z-10 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Saldo Principal</span>
            <span className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
              {userBalanceSats.toLocaleString('pt-BR')} <span className="text-orange-500 text-sm font-bold">SATS</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block font-mono">{userBalance.toFixed(8)} BTC</span>
            <span className="text-xs font-semibold text-emerald-400 block mt-0.5">{currentBalanceBRL}</span>
          </div>
        </div>

        {isLoggedIn && (
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            {/* Em Jogo */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Registrado em rifas
              </span>
              <span className="font-semibold text-blue-400 font-mono">
                {inGameBalanceSats.toLocaleString('pt-BR')} SATS ({inGameBalance.toFixed(8)} BTC)
              </span>
            </div>

            {/* Disponível para saque */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Saldo registrado
              </span>
              <span className="font-semibold text-emerald-400 font-mono">
                {availableToWithdrawSats.toLocaleString('pt-BR')} SATS ({availableToWithdraw.toFixed(8)} BTC)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Botões de Ação da Carteira */}
      {isLoggedIn ? (
        <div className="grid grid-cols-3 gap-2.5 relative z-10">
          <Button
            variant="outline"
            className="bg-white/10 border border-white/20 text-white/60 text-xs py-5 rounded-xl font-bold flex items-center gap-1.5"
            disabled
            title="Depósitos serão habilitados após a integração com o provedor de pagamentos."
          >
            <Zap className="w-4 h-4 text-orange-400" />
            Em breve
          </Button>
          <Button
            variant="outline"
            className="bg-white/10 border border-white/20 text-white/60 text-xs py-5 rounded-xl font-bold flex items-center gap-1.5"
            disabled
            title="Saques serão habilitados após a integração com o provedor de pagamentos."
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            Em breve
          </Button>
          <Button
            className="bg-gradient-to-r from-orange-500/40 to-amber-600/40 border-none text-white/70 text-xs py-5 rounded-xl font-bold flex items-center gap-1.5"
            disabled
            title="Transferências entre usuários ainda não estão disponíveis."
          >
            <Send className="w-4 h-4 text-white" />
            Em breve
          </Button>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/5 p-3.5 rounded-xl border border-orange-500/20 relative z-10 text-center">
          <p className="text-xs text-orange-200 font-medium">
            🔒             Faça login para consultar os saldos registrados na sua conta.
          </p>
        </div>
      )}
    </div>
  );
};

// Modal de Depósito Aprimorado (Lightning & On-Chain)
const DepositModal = ({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [depositTab, setDepositTab] = useState<'lightning' | 'onchain'>('lightning');
  const [selectedSats, setSelectedSats] = useState<number>(5000);
  const [customSats, setCustomSats] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  const bitcoinAddress = import.meta.env.VITE_BITCOIN_DEPOSIT_ADDRESS || '';

  const activeSats = customSats ? Math.max(100, parseInt(customSats) || 0) : selectedSats;
  const simulatedInvoice = '';

  useEffect(() => {
    if (!isOpen) return;
    setQrCodeDataURL('');
    setIsGeneratingQR(false);
  }, [isOpen]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[75]">
      <div className="w-full max-w-md bg-white rounded-2xl border-[4px] border-black shadow-[8px_10px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden animate-in fade-in-0 zoom-in-95">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-orange-500 rounded-full flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="font-extrabold text-lg">₿</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-950">Depositar Bitcoin</h3>
                <p className="text-xs text-gray-500 font-medium">Integração de pagamentos ainda não habilitada</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-100"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-gray-500" />
            </Button>
          </div>

          {/* Seletor de Rede (Lightning vs On-chain) */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl border-2 border-black">
            <button
              onClick={() => setDepositTab('lightning')}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                depositTab === 'lightning'
                  ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-black'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              Lightning (Instantâneo)
            </button>
            <button
              onClick={() => setDepositTab('onchain')}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                depositTab === 'onchain'
                  ? 'bg-orange-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-black'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <span>⛓️</span>
              On-Chain (BTC)
            </button>
          </div>

          {depositTab === 'lightning' ? (
            <div className="space-y-3">
              {/* Seleção rápida de valor em Sats */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-gray-700">Escolha a quantia em Sats:</span>
                  <span className="text-xs font-black text-orange-600">
                    {activeSats.toLocaleString('pt-BR')} sats ({(activeSats / 100000000).toFixed(8)} BTC)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1000, 5000, 10000, 50000].map((sats) => (
                    <button
                      key={sats}
                      onClick={() => {
                        setSelectedSats(sats);
                        setCustomSats('');
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border-2 border-black transition-all ${
                        selectedSats === sats && !customSats
                          ? 'bg-black text-white shadow-none'
                          : 'bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                    >
                      {sats >= 1000 ? `${sats / 1000}k` : sats}
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Code Container */}
              <div className="bg-gray-50 p-3 rounded-xl border-2 border-black flex flex-col items-center justify-center">
                <div className="w-48 h-48 bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-center">
                  {isGeneratingQR ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                  ) : qrCodeDataURL ? (
                    <img src={qrCodeDataURL} alt="Lightning QR" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <span className="text-[11px] text-gray-500 font-medium mt-2 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Escaneie com qualquer carteira Lightning
                </span>
              </div>

              {/* Invoice Text e Copiar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-700">Invoice Lightning</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Taxa zero</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={simulatedInvoice}
                    readOnly
                    className="w-full text-xs font-mono bg-gray-100 rounded-lg py-2.5 pl-3 pr-24 border border-gray-300 outline-none select-all"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCopy(simulatedInvoice)}
                    className="absolute right-1 h-7 text-xs bg-black text-white hover:bg-gray-800 rounded-md font-bold px-2.5"
                  >
                    {showCopied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {showCopied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* On-Chain Container */}
              <div className="bg-gray-50 p-3 rounded-xl border-2 border-black flex flex-col items-center justify-center">
                <div className="w-48 h-48 bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-center">
                  {isGeneratingQR ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                  ) : qrCodeDataURL ? (
                    <img src={qrCodeDataURL} alt="Bitcoin Address QR" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <span className="text-[11px] text-gray-500 font-medium mt-2">
                  Não envie Bitcoin: depósitos ainda não estão habilitados.
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-700">Endereço de Depósito BTC</span>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={bitcoinAddress}
                    readOnly
                    className="w-full text-xs font-mono bg-gray-100 rounded-lg py-2.5 pl-3 pr-24 border border-gray-300 outline-none select-all"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCopy(bitcoinAddress)}
                    className="absolute right-1 h-7 text-xs bg-black text-white hover:bg-gray-800 rounded-md font-bold px-2.5"
                  >
                    {showCopied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {showCopied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>Não envie valores. Ainda não há monitoramento de pagamentos nem crédito automático.</span>
              </div>
            </div>
          )}

          {/* Garantia de Privacidade e Anonimato */}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-2 text-[11px] text-gray-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Os depósitos só serão ativados depois de existir um fluxo seguro de conciliação.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal de Saque Aprimorado
const WithdrawModal = ({
  isOpen,
  onClose,
  availableToWithdraw = 0
}: {
  isOpen: boolean;
  onClose: () => void;
  availableToWithdraw?: number;
}) => {
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [unit, setUnit] = useState<'btc' | 'sats'>('sats');
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableSats = Math.round(availableToWithdraw * 100000000);
  const networkFeeSats = 1000; // 1.000 sats de taxa de rede
  const networkFeeBTC = 0.00001000;

  const numericSats = unit === 'sats'
    ? parseInt(withdrawAmount) || 0
    : Math.round((parseFloat(withdrawAmount) || 0) * 100000000);

  const netReceivedSats = Math.max(0, numericSats - networkFeeSats);
  const netReceivedBTC = (netReceivedSats / 100000000).toFixed(8);

  const setPercentage = (pct: number) => {
    const targetSats = Math.floor(availableSats * (pct / 100));
    if (unit === 'sats') {
      setWithdrawAmount(targetSats.toString());
    } else {
      setWithdrawAmount((targetSats / 100000000).toFixed(8));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericSats < 2000) {
      alert('O saque mínimo é de 2.000 Satoshis (0.00002000 BTC).');
      return;
    }
    if (numericSats > availableSats) {
      alert('Valor solicitado excede o saldo disponível para saque.');
      return;
    }
    alert('Saques ainda não estão habilitados. Nenhuma solicitação foi enviada.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[75]">
      <div className="w-full max-w-md bg-white rounded-2xl border-[4px] border-black shadow-[8px_10px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden animate-in fade-in-0 zoom-in-95">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-950">Saque Bitcoin</h3>
                <p className="text-xs text-gray-500 font-medium">Transferência direta para sua carteira externa</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-100"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-gray-500" />
            </Button>
          </div>

          {/* Saldo Liberado Banner */}
          <div className="bg-emerald-50 border-2 border-emerald-600 rounded-xl p-3 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-emerald-800 uppercase font-black tracking-wide block">Liberado p/ Saque</span>
              <span className="text-lg font-black text-emerald-950">
                {availableSats.toLocaleString('pt-BR')} <span className="text-xs font-bold">SATS</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-800">{availableToWithdraw.toFixed(8)} BTC</span>
            </div>
          </div>

          {/* Formulário */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-800 mb-1 block">Endereço Bitcoin ou Invoice Lightning</label>
              <input
                type="text"
                required
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="Ex: bc1q... ou lnbc..."
                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-mono border-2 border-black outline-none focus:bg-white placeholder:text-gray-400"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-gray-800">Valor do Saque</label>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setUnit('sats')}
                    className={`px-1.5 py-0.5 rounded font-bold ${unit === 'sats' ? 'bg-black text-white' : 'text-gray-500'}`}
                  >
                    SATS
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('btc')}
                    className={`px-1.5 py-0.5 rounded font-bold ${unit === 'btc' ? 'bg-black text-white' : 'text-gray-500'}`}
                  >
                    BTC
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={unit === 'sats' ? 'Ex: 10000' : '0.00010000'}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-mono border-2 border-black outline-none pr-14 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setPercentage(100)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black bg-black text-white px-2 py-1 rounded-md"
                >
                  MAX
                </button>
              </div>

              {/* Botões Rápidos de Porcentagem */}
              <div className="grid grid-cols-4 gap-1 mt-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentage(pct)}
                    className="py-1 text-[10px] font-bold rounded-lg border border-black bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo de Taxas */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Taxa de rede fixa:</span>
                <span className="font-mono">{networkFeeSats} SATS ({networkFeeBTC.toFixed(8)} BTC)</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                <span>Você receberá:</span>
                <span className="font-mono text-emerald-600">{netReceivedSats.toLocaleString('pt-BR')} SATS ({netReceivedBTC} BTC)</span>
              </div>
            </div>
          </div>

          {/* Botão de Envio */}
          <Button
            type="submit"
            disabled={isSubmitting || numericSats < 2000 || numericSats > availableSats}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 border-2 border-black shadow-[3px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] transition-all"
          >
            {isSubmitting ? 'Processando Saque...' : 'Confirmar Saque Anônimo'}
          </Button>

          <p className="text-[10px] text-gray-500 text-center font-medium">
            🛡️ Saque auditado na blockchain. Saque mínimo de 2.000 sats (0.00002000 BTC).
          </p>
        </form>
      </div>
    </div>
  );
};

// Modal de Gorjeta Aprimorado
const TipModal = ({
  isOpen,
  onClose,
  userBalance = 0
}: {
  isOpen: boolean;
  onClose: () => void;
  userBalance?: number;
}) => {
  const [recipientNick, setRecipientNick] = useState('');
  const [tipSats, setTipSats] = useState<number>(1000);
  const [customTip, setCustomTip] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const availableSats = Math.round(userBalance * 100000000);
  const finalTipSats = customTip ? Math.max(0, parseInt(customTip) || 0) : tipSats;

  const handleSendTip = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = recipientNick.trim().replace(/^@/, '');
    if (!cleanNick) {
      alert('Informe o @nickname do participante que receberá a gorjeta.');
      return;
    }
    if (finalTipSats <= 0) {
      alert('Informe um valor válido em satoshis.');
      return;
    }
    if (finalTipSats > availableSats) {
      alert('Saldo insuficiente para enviar esta gorjeta.');
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      alert('Transferências entre usuários ainda não estão habilitadas. Nenhuma gorjeta foi enviada.');
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[75]">
      <div className="w-full max-w-md bg-white rounded-2xl border-[4px] border-black shadow-[8px_10px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden animate-in fade-in-0 zoom-in-95">
        <form onSubmit={handleSendTip} className="p-5 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-400 rounded-full flex items-center justify-center text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Send className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-950">Enviar Gorjeta</h3>
                <p className="text-xs text-gray-500 font-medium">Transferência instantânea e anônima entre saldos</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-100"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-gray-500" />
            </Button>
          </div>

          <div className="space-y-3">
            {/* Destinatário */}
            <div>
              <label className="text-xs font-bold text-gray-800 mb-1 block">Para qual @nickname?</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">@</span>
                <input
                  type="text"
                  required
                  value={recipientNick}
                  onChange={(e) => setRecipientNick(e.target.value.replace(/^@/, ''))}
                  placeholder="satoshi_21"
                  className="w-full bg-gray-50 rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold border-2 border-black outline-none focus:bg-white placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Presets de Gorjeta em Sats */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-800">Quantia da Gorjeta</label>
                <span className="text-[11px] font-bold text-amber-700">
                  Disponível: {availableSats.toLocaleString('pt-BR')} sats
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[1000, 2500, 5000].map((sats) => (
                  <button
                    key={sats}
                    type="button"
                    onClick={() => {
                      setTipSats(sats);
                      setCustomTip('');
                    }}
                    className={`py-2 text-xs font-black rounded-xl border-2 border-black transition-all ${
                      tipSats === sats && !customTip
                        ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    +{sats.toLocaleString('pt-BR')} sats
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder="Ou digite outra quantia em sats..."
                className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs border border-gray-300 outline-none focus:border-black font-mono"
              />
            </div>

            {/* Mensagem Opcional */}
            <div>
              <label className="text-xs font-bold text-gray-800 mb-1 block">Recado Opcional</label>
              <textarea
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Ex: Boa sorte na próxima rifa!"
                className="w-full bg-gray-50 rounded-xl p-3 text-xs border border-gray-300 outline-none focus:border-black resize-none h-16"
              />
            </div>
          </div>

          {/* Botão de Enviar */}
          <Button
            type="submit"
            disabled={isSending || finalTipSats <= 0 || finalTipSats > availableSats || !recipientNick}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black font-black py-5 border-2 border-black shadow-[3px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] transition-all"
          >
            {isSending ? 'Enviando...' : `Enviar ${finalTipSats.toLocaleString('pt-BR')} Sats ⚡`}
          </Button>

          <p className="text-[10px] text-gray-500 text-center font-medium">
            ⚡ Transferência instantânea entre usuários sem taxa de rede.
          </p>
        </form>
      </div>
    </div>
  );
};

// Modal de Configurações
const SettingsModal = ({
  isOpen,
  onClose,
  isLoggedIn = false,
  onLogout,
}: {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn?: boolean;
  onLogout?: () => void;
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('pt');
  const [unit, setUnit] = useState('btc');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <Card className="w-full max-w-md font-montserrat relative
        bg-white/95 border-[4px] border-black
        shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]
        hover:shadow-[6px_8px_0px_0px_rgba(0,0,0,0.95)]
        transition-all duration-300 rounded-xl overflow-hidden
        group backdrop-blur-sm"
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Configurações</h3>
                <p className="text-sm text-muted-foreground">Personalize sua experiência</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-black/5"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {isLoggedIn && onLogout && (
            <Button
              variant="outline"
              className="w-full border-2 border-black"
              onClick={() => {
                onLogout()
                onClose()
              }}
            >
              Sair da conta
            </Button>
          )}

          {/* Configurações */}
          <div className="space-y-2">
            {/* Exibição */}
            <div className="bg-gradient-to-br from-secondary/90 via-secondary to-secondary/80 p-3 rounded-xl border border-black/10">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Exibição
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mostrar saldo</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBalance(!showBalance)}
                    className="h-8 px-2"
                  >
                    {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Unidade</span>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="text-xs bg-white/20 border border-black/10 rounded px-2 py-1"
                  >
                    <option value="btc">BTC</option>
                    <option value="sats">Satoshis</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tema escuro</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDarkMode(!darkMode)}
                    className="h-8 px-2"
                  >
                    {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Notificações */}
            <div className="bg-gradient-to-br from-secondary/90 via-secondary to-secondary/80 p-3 rounded-xl border border-black/10">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notificações
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Alertas de preço</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotifications(!notifications)}
                    className="h-8 px-2"
                  >
                    {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Notificações push</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Segurança */}
            <div className="bg-gradient-to-br from-secondary/90 via-secondary to-secondary/80 p-3 rounded-xl border border-black/10">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Segurança
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Autenticação 2FA</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                  >
                    Configurar
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Alterar senha</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                  >
                    Alterar
                  </Button>
                </div>
              </div>
            </div>

            {/* Idioma */}
            <div className="bg-gradient-to-br from-secondary/90 via-secondary to-secondary/80 p-3 rounded-xl border border-black/10">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Idioma
              </h4>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full text-sm bg-white/20 border border-black/10 rounded px-3 py-2"
              >
                <option value="pt">Português (BR)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          {/* Botão Salvar */}
          <Button
            className="w-full bg-gradient-to-r from-primary/90 to-primary
              hover:from-primary hover:to-primary/90 text-white font-medium
              shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
              hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
              hover:translate-y-[1px]
              active:shadow-none
              active:translate-y-[2px]
              transition-all h-11"
          >
            Salvar Configurações
          </Button>
        </div>
      </Card>
    </div>
  );
};

// Mova o array magicSatsInfo para fora do componente
const magicSatsInfo = [
  // Sobre o MagicSats
  "✨ MagicSats: A primeira rifa de Bitcoin verdadeiramente transparente, utilizando a blockchain como fonte de aleatoriedade garantida",
  "🎯 No MagicSats você concorre a prêmios em Bitcoin com total transparência e rastreabilidade",
  "💎 Já distribuímos mais de 44.000 satoshis em prêmios para nossa comunidade",
  "🔒 Nossos sorteios usam o hash do bloco Bitcoin mais recente como fonte de aleatoriedade",

  // História do Bitcoin
  "📜 O Bitcoin nasceu em 31 de outubro de 2008, quando Satoshi Nakamoto publicou o whitepaper",
  "🌱 O primeiro bloco Bitcoin (Genesis) foi minerado em 3 de janeiro de 2009",
  "🍕 Em 22 de maio de 2010, Laszlo Hanyecz comprou duas pizzas por 10.000 BTC, primeira compra real com Bitcoin",
  "💻 O código-fonte do Bitcoin é open source e mantido por desenvolvedores voluntários do mundo todo",
  "🎓 O whitepaper do Bitcoin tem apenas 9 páginas e revolucionou o sistema financeiro global",
  "🌐 A rede Bitcoin nunca ficou offline desde seu lançamento em 2009",

  // Tecnologia Bitcoin
  "⚡ A Lightning Network permite transações Bitcoin instantâneas e com taxas mínimas",
  "🔑 As chaves privadas Bitcoin usam criptografia de curva elíptica (ECDSA)",
  "⛏️ A mineração Bitcoin ajusta sua dificuldade a cada 2016 blocos (aproximadamente 2 semanas)",
  "🎲 A chance de adivinhar uma chave privada Bitcoin é menor que ganhar na loteria 1 milhão de vezes seguidas",
  "🔍 Cada bloco Bitcoin contém um hash do bloco anterior, formando uma cadeia imutável",
  "📦 O tamanho médio de um bloco Bitcoin é de 1.3MB após a implementação do SegWit",

  // Economia Bitcoin
  "💰 O fornecimento total de Bitcoin é limitado a 21 milhões de unidades",
  "📊 O halving do Bitcoin ocorre a cada 210.000 blocos (aproximadamente 4 anos)",
  "🏦 Grandes empresas como Tesla, MicroStrategy e Square têm Bitcoin em seus balanços",
  "📈 Bitcoin foi o ativo que mais valorizou na década de 2010-2020",
  "🌍 Bitcoin é aceito como meio de pagamento em mais de 100 países",
  "💱 O menor preço registrado do Bitcoin foi $0.00076 em 2009",

  // Curiosidades Técnicas
  "🧮 Um satoshi (0.00000001 BTC) é a menor unidade do Bitcoin",
  "🔐 Existem mais combinações possíveis de chaves privadas Bitcoin do que átomos no universo observável",
  "🎯 A probabilidade de encontrar uma colisão de hash SHA-256 é de 1 em 2^256",
  "⚡ A rede Lightning pode teoricamente processar milhões de transações por segundo",
  "🔄 O algoritmo de mineração SHA-256 foi criado pela NSA",
  "📡 Existem mais de 15.000 nodes Bitcoin ativos no mundo",

  // Adoção e Uso
  "🇸🇻 El Salvador foi o primeiro país a adotar Bitcoin como moeda oficial",
  "🏪 Mais de 250.000 estabelecimentos aceitam pagamentos em Bitcoin globalmente",
  "🎮 A indústria de games está integrando Bitcoin através de micropagamentos",
  "📱 Existem mais de 100 milhões de carteiras Bitcoin criadas",
  "🏢 Mais de 25 empresas de capital aberto têm Bitcoin em reserva",
  "🌐 A rede Bitcoin processa mais de 300.000 transações por dia",

  // Segurança e Privacidade
  "🛡️ A rede Bitcoin nunca foi hackeada em seus mais de 14 anos de existência",
  "🔒 O Bitcoin usa o mesmo padrão de criptografia usado por bancos e governos",
  "🕵️ Cada transação Bitcoin é verificada por dezenas de milhares de computadores",
  "🔐 A seed phrase de 12 palavras pode gerar 2^132 combinações diferentes",
  "⚔️ O poder computacional da rede Bitcoin é maior que todos os supercomputadores juntos",
  "🛑 É impossível criar Bitcoins falsos devido à matemática criptográfica",

  // Inovações e Futuro
  "🌩️ A Lightning Network permite pagamentos instantâneos do tamanho de um átomo",
  "🔄 O Taproot trouxe mais privacidade e eficiência para transações Bitcoin",
  "🌐 O protocolo Bitcoin é atualizado através de BIPs (Bitcoin Improvement Proposals)",
  "📡 Satélites transmitem a blockchain Bitcoin 24/7 para todo o planeta",
  "🚀 Bitcoin pode ser usado para micropagamentos em jogos e aplicativos",
  "🌍 A rede Bitcoin é a maior rede de computadores descentralizada do mundo",

  // Impacto Social
  "🌱 Mineração Bitcoin incentiva o uso de energia renovável",
  "🏗️ Bitcoin permite inclusão financeira para bilhões de pessoas sem acesso a bancos",
  "🤝 A rede Bitcoin processa bilhões de dólares em transações diariamente sem intermediários",
  "📚 Existem mais de 100 livros publicados sobre Bitcoin",
  "🎓 Universidades como MIT e Stanford oferecem cursos sobre Bitcoin",
  "🌍 Bitcoin é usado para enviar remessas internacionais sem fronteiras",

  // Mensagem Especial
  "🇧🇷 Feito no Brasil, com amor e alegria",

  // Mineração e Energia
  "⚡ A mineração Bitcoin consome menos energia que secadores de roupa nos EUA",
  "♻️ Mais de 50% da mineração Bitcoin usa energia renovável",
  "🌋 El Salvador está minerando Bitcoin usando energia geotérmica de vulcões",
  "💨 Mineradores Bitcoin estão capturando gás metano que seria desperdiçado",
  "🌊 Existem fazendas de mineração usando energia hidrelétrica excedente",
  "🔋 A mineração ajuda a estabilizar redes elétricas consumindo energia excedente",

  // Desenvolvimento e Comunidade
  "👩‍💻 Milhares de desenvolvedores trabalham voluntariamente no Bitcoin",
  "🤝 O Bitcoin tem a maior comunidade de desenvolvedores das criptomoedas",
  "🔍 Todas as mudanças no código Bitcoin passam por extensa revisão da comunidade",
  "🌐 Existem mais de 100 implementações diferentes de nodes Bitcoin",
  "📱 Há mais de 30 carteiras Bitcoin de código aberto populares",
  "🛠️ O Bitcoin recebe atualizações constantes através de soft forks",

  // Curiosidades Culturais
  "🎨 O símbolo ₿ foi escolhido pela comunidade em 2010",
  "🎮 O primeiro jogo Bitcoin foi criado em 2012",
  "📺 Bitcoin já apareceu em séries como The Simpsons e Mr. Robot",
  "🎵 Existem mais de 100 músicas sobre Bitcoin",
  "📚 O termo 'HODL' nasceu de um erro de digitação em um fórum em 2013",
  "🎯 A Pizza Day (22/05) é comemorada anualmente pela comunidade",

  // Segurança Avançada
  "🔒 O Bitcoin usa mais de 5 camadas diferentes de criptografia",
  "🛡️ Cada carteira Bitcoin pode ter múltiplas camadas de proteção",
  "🎲 A entropia usada para gerar chaves Bitcoin é maior que em sistemas bancários",
  "🔑 Uma seed phrase pode recuperar todas as suas chaves privadas",
  "📡 Nodes Bitcoin verificam cada transação independentemente",
  "🚫 Transações Bitcoin não podem ser revertidas ou censuradas",

  // Escalabilidade e Futuro
  "⚡ A Lightning Network já tem mais de 100.000 canais ativos",
  "🔄 O Taproot permite contratos inteligentes mais eficientes no Bitcoin",
  "📦 O Schnorr permite assinaturas múltiplas mais privadas e eficientes",
  "🌐 Sidechains permitem novas funcionalidades sem comprometer a segurança",
  "🚀 RGB permite tokens e contratos inteligentes na Lightning Network",
  "🔮 O desenvolvimento do Bitcoin segue um roadmap conservador e seguro",

  // Economia e Mercado
  "📊 Bitcoin tem o maior volume de negociação entre todas as criptomoedas",
  "🏦 Mais de 30 ETFs de Bitcoin foram aprovados globalmente",
  "💹 Bitcoin é negociado 24/7 em centenas de exchanges",
  "🌍 Existem mais de 40.000 caixas eletrônicos de Bitcoin no mundo",
  "💳 Milhões de cartões de débito são lastreados em Bitcoin",
  "📈 O mercado Bitcoin tem liquidez superior a muitas bolsas tradicionais",

  // Mensagem Especial (mantida no final)
  "🇧🇷 Feito no Brasil, com amor e alegria"
];

// Adicionar função de som
const playKeySound = (isSelected: boolean) => {
  const audio = new Audio(isSelected ? '/soft-click.mp3' : '/soft-unclick.mp3');
  audio.volume = 0.10;
  audio.play().catch(() => {});
};

// Função de ripple
const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
  const button = event.currentTarget;
  const ripple = document.createElement("span");

  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  const rect = button.getBoundingClientRect();

  ripple.style.width = ripple.style.height = `${diameter}px`;
  ripple.style.left = `${event.clientX - rect.left - radius}px`;
  ripple.style.top = `${event.clientY - rect.top - radius}px`;
  ripple.className = "ripple";

  const existingRipple = button.getElementsByClassName("ripple")[0];
  if (existingRipple) {
    existingRipple.remove();
  }

  button.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
};

// Adicionar array de steps
const steps = [
  {
    icon: "👤",
    text: "Crie sua Conta",
    detail: "Registre-se rapidamente para participar das rifas em Bitcoin"
  },
  {
    icon: "₿",
    text: "Pagamentos em preparação",
    detail: "Depósitos e saques só serão liberados após integração segura com um provedor"
  },
  {
    icon: "🎲",
    text: "Escolha seus Números",
    detail: "Selecione seus números da sorte para concorrer"
  },
  {
    icon: "✨",
    text: "Aguarde o Sorteio",
    detail: "Acompanhe ao vivo o sorteio dos prêmios em Bitcoin"
  }
];

// Componente do Card de Estatísticas
const StatsCard = ({
  isOpen,
  onClose,
  isLoggedIn,
  luckyNumbers,
  nextRoundNumber,
  onLogin,
  onSchedule,
}: {
  isOpen: boolean
  onClose: () => void
  isLoggedIn: boolean
  luckyNumbers: LuckyNumber[]
  nextRoundNumber: number
  onLogin: () => void
  onSchedule: (number: number) => void
}) => {
  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
        <div className="bg-gradient-to-b from-white to-gray-100 rounded-xl w-full max-w-md
          border-[4px] border-black
          shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
          hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
          hover:translate-y-[2px]
          active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
          active:translate-y-[6px]
          relative overflow-hidden group
          transition-all duration-200">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Meus Números da Sorte</h2>
              </div>
              <div className="flex items-center gap-2">
                {!isLoggedIn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogin}
                  className="text-xs px-2 py-1 h-6"
                >
                Login
                </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
            {!isLoggedIn ? (
              <>
                <div className="bg-white p-4 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] text-center">
                  <div className="flex flex-col items-center gap-2 mb-3">
                    <Star className="w-10 h-10 text-primary" />
                    <span className="font-medium text-lg">Acesse seus Números da Sorte</span>
                      </div>
                  <p className="text-sm text-black/70 mb-4">
                    Somente o vencedor da rodada atual pode acessar antecipadamente a próxima e reservar o mesmo número que ganhou.
                  </p>
                  <div className="flex items-center gap-2">
                      <Button
                      className="flex-1 bg-gradient-to-r from-primary/90 to-primary text-white"
                      onClick={onLogin}
                    >
                      <LogIn className="w-4 h-4 mr-2" /> Fazer Login
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={onLogin}
                    >
                      Criar Conta
                      </Button>
                    </div>
                      </div>
                <div className="bg-black/5 p-3 rounded-lg text-xs text-muted-foreground flex items-center gap-2 mt-2">
                  <Info className="w-4 h-4" />
                  Registre-se para acompanhar e gerenciar seus Números da Sorte, aumentando suas chances nas próximas rifas!
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-primary" />
                    <span className="font-medium">Seus Números da Sorte</span>
                        </div>
                  {luckyNumbers.length === 0 ? (
                    <div className="text-center text-black/60 text-sm py-6">
                      Você não venceu a rodada atual. Quando ela terminar, a próxima rodada será liberada para todos.
                      </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <p className="text-xs text-black/70">
                        Reserva antecipada exclusiva da rodada #{nextRoundNumber}
                      </p>
                      {luckyNumbers.map((item) => (
                        <div key={item.number} className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-3">
                            <Star className="w-6 h-6 text-yellow-500" />
                            <span className="text-lg font-bold">{String(item.number).padStart(2, '0')}</span>
                      </div>
                          <div className="flex flex-col items-end gap-1 text-xs">
                        <span className="text-black/80 font-medium">Número vencedor</span>
                        <span className="text-primary font-semibold">
                          {item.reservationsLeft > 0 ? "Reserva disponível" : "Já reservado"}
                        </span>
                        <Button
                          size="sm"
                          disabled={item.reservationsLeft < 1}
                          className="h-7 text-xs"
                          onClick={() => onSchedule(item.number)}
                        >
                          {item.reservationsLeft > 0 ? "Garantir meu número" : "Número garantido"}
                        </Button>
                        </div>
                        </div>
                      ))}
                        </div>
                  )}
                      </div>
                <div className="bg-black/5 p-3 rounded-lg text-xs text-muted-foreground flex items-center gap-2 mt-2">
                  <Info className="w-4 h-4" />
                  A reserva é validada pelo servidor e só pode ser usada uma vez na próxima rodada.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

// Componente de Como Funciona
const HowItWorksModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: Lock,
      title: "Segurança Blockchain",
      description: "Utilizamos a tecnologia blockchain para gerar números verdadeiramente aleatórios e imutáveis"
    },
    {
      icon: Hash,
      title: "Geração Criptográfica",
      description: "Cada número é gerado através de um processo criptográfico SHA256, garantindo total aleatoriedade"
    },
    {
      icon: Fingerprint,
      title: "Transparência Total",
      description: "Todo o processo é pblico e pode ser auditado por qualquer participante a qualquer momento"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-background/95 to-background rounded-2xl w-full max-w-md
        shadow-2xl border border-border/50 relative animate-in fade-in-0 zoom-in-95">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Tecnologia de Sorteio</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-background/80"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10
                  flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}

            {/* Exemplo Visual */}
            <div className="mt-6 p-4 bg-secondary/30 rounded-xl border border-border/50">
              <h3 className="font-medium mb-3">Processo de Verificação</h3>
              <div className="space-y-2 text-sm">
                <p className="font-mono bg-black/20 p-2 rounded">
                  Resultado = SHA256(blockchain_seed + server_hash)
                </p>
                <p className="text-muted-foreground">
                  O resultado é gerado através da combinação de uma semente blockchain com o hash do servidor,
                  criando um número aleatório que pode ser verificado publicamente na blockchain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Atualizar o FairnessCard para incluir o modal de Como Funciona
const FairnessCard = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedRound, setSelectedRound] = useState("Round #0");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-white to-gray-100 rounded-xl w-full max-w-md
        border-[4px] border-black
        shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
        hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
        hover:translate-y-[2px]
        active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
        active:translate-y-[6px]
        relative overflow-hidden group
        transition-all duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              <h2 className="text-xl font-bold">Imparcialidade</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

            <div className="space-y-4">
            {/* Explicação e Hash Atual */}
            <div className="bg-white p-2.5 rounded-lg
              border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
              hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
              hover:translate-y-[1px]
              transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Hash da Rodada Atual</span>
                  <Button
                    variant="ghost"
                    size="sm"
                  className="ml-auto h-6 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar
                  </Button>
                </div>
              <div className="bg-black/5 backdrop-blur-sm rounded-lg p-2 font-mono text-xs
                text-primary/90 break-all border border-primary/20 mb-2">
                  7b6f5d437f37d4d1f1e994d9663a850a329b857e94e0c68fe2
                </div>
              <p className="text-xs text-black/70">
                Utilizamos o algoritmo SHA256 do Bitcoin para gerar números verdadeiramente aleatórios,
                garantindo total transparência.
              </p>
            </div>

            {/* Verificação da Rodada */}
            <div className="bg-white p-2.5 rounded-lg
              border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
              hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
              hover:translate-y-[1px]
              transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Verificação da Rodada</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={selectedRound}
                    onChange={(e) => setSelectedRound(e.target.value)}
                    className="flex-1 bg-black/5 rounded-lg p-1.5 text-xs border border-black/10 focus:ring-primary"
                  >
                    <option value="Round #0">Round #0</option>
                    <option value="Round #1">Round #1</option>
                    <option value="Round #2">Round #2</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Hash
                  </Button>
                </div>

                <div className="bg-black/5 rounded-lg p-2 text-xs font-mono text-primary/90">
                  70_vluvckHUwyZNEd
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-gradient-to-r from-primary/90 to-primary
                  hover:from-primary hover:to-primary/90 text-white"
                onClick={() => setIsVerifying(true)}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  "Verificar Hash"
                )}
              </Button>
              <Button
                variant="outline"
                className="border-2 border-black hover:bg-black/5"
              >
                Como Funciona
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal de Login/Registro Aprimorado (E-mail, Nick, Senha e Resend)
const AuthModal = ({
  isOpen,
  onClose,
  onLoginSuccess,
  login,
  register,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  login: (emailOrNick: string, password: string) => Promise<unknown>;
  register: (
    nickname: string,
    email: string,
    password: string,
    marketingOptIn?: boolean,
  ) => Promise<{ user: unknown | null; needsConfirmation: boolean }>;
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [formData, setFormData] = useState({
    nickname: '',
    emailOrNick: '',
    email: '',
    password: '',
    confirmPassword: '',
    marketingOptIn: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        if (!formData.emailOrNick.trim()) {
          throw new Error('Informe seu e-mail ou nickname.');
        }
        await login(formData.emailOrNick.trim(), formData.password);
        onLoginSuccess();
        onClose();
      } else if (authMode === 'register') {
        const cleanNick = formData.nickname.trim().replace(/^@/, '');
        if (cleanNick.length < 3) {
          throw new Error('O nickname deve ter no mínimo 3 caracteres.');
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error('As senhas digitadas não coincidem.');
        }
        const result = await register(
          cleanNick,
          formData.email.trim(),
          formData.password,
          formData.marketingOptIn,
        );
        if (result.needsConfirmation) {
          setConfirmationSent(true);
        } else {
          onLoginSuccess();
          onClose();
        }
      } else if (authMode === 'forgot') {
        if (!formData.email.trim() || !formData.email.includes('@')) {
          throw new Error('Informe um e-mail válido para recuperação.');
        }
        const { requestPasswordReset } = await import('@/lib/auth.functions');
        await requestPasswordReset({
          data: {
            email: formData.email.trim().toLowerCase(),
            origin: window.location.origin,
          },
        });
        setForgotSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (mode: 'login' | 'register' | 'forgot') => {
    setAuthMode(mode);
    setError('');
    setForgotSent(false);
    setConfirmationSent(false);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md border-[4px] border-black shadow-[8px_10px_0px_0px_rgba(0,0,0,1)] relative animate-in fade-in-0 zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b-2 border-black bg-gradient-to-r from-orange-400 via-amber-400 to-amber-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white border-2 border-white shadow-md">
                <Bitcoin className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-black">
                  {authMode === 'login' && 'Entrar na Conta'}
                  {authMode === 'register' && 'Criar Conta Anônima'}
                  {authMode === 'forgot' && 'Recuperar Acesso'}
                </h2>
                <span className="text-[11px] font-bold text-black/75 block">
                  {authMode === 'login' && 'Entre com seu e-mail ou nickname'}
                  {authMode === 'register' && 'Escolha seu nick único e participe'}
                  {authMode === 'forgot' && 'Instruções anônimas via Resend'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-black/10 text-black"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Abas Login / Registro */}
        {authMode !== 'forgot' && (
          <div className="grid grid-cols-2 border-b-2 border-black bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                authMode === 'login'
                  ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Fazer Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                authMode === 'register'
                  ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              ⚠️ {error}
            </div>
          )}

          {(forgotSent || confirmationSent) && (
            <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p>
                {confirmationSent
                  ? 'Se o cadastro foi concluído, enviaremos um link para confirmar seu e-mail.'
                  : 'Se este e-mail estiver cadastrado, enviaremos instruções para redefinir sua senha.'}
              </p>
              <p className="text-[11px] font-normal text-emerald-800">
                Verifique sua caixa de entrada. O endereço de e-mail não é exibido publicamente.
              </p>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="mt-2 text-xs font-black underline text-black block mx-auto"
              >
                Voltar para o Login
              </button>
            </div>
          )}

          {!forgotSent && !confirmationSent && authMode === 'login' && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-800 mb-1 block">E-mail ou Nickname</label>
                <input
                  type="text"
                  required
                  value={formData.emailOrNick}
                  onChange={(e) => setFormData(prev => ({ ...prev, emailOrNick: e.target.value }))}
                  placeholder="seu_nick ou voce@email.com"
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-medium border-2 border-black outline-none focus:bg-white"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-800">Senha</label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] font-bold text-orange-600 hover:underline"
                  >
                    Esqueceu?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-medium border-2 border-black outline-none focus:bg-white"
                />
              </div>
            </>
          )}

          {!forgotSent && !confirmationSent && authMode === 'register' && (
            <>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-800">Nickname Público</label>
                  <span className="text-[10px] text-gray-500 font-medium">Visível nas rifas</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">@</span>
                  <input
                    type="text"
                    required
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value.replace(/^@/, '') }))}
                    placeholder="satoshi_21"
                    className="w-full bg-gray-50 rounded-xl pl-7 pr-3 py-2 text-xs font-bold border-2 border-black outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-800">E-mail</label>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Privado
                  </span>
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="seu@email.com"
                  className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs font-medium border-2 border-black outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-800 mb-1 block">Senha</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs font-medium border-2 border-black outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-800 mb-1 block">Confirmar Senha</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Repita a senha"
                    className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs font-medium border-2 border-black outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-900 font-medium">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={formData.marketingOptIn}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      marketingOptIn: e.target.checked,
                    }))}
                    className="mt-0.5 accent-orange-500"
                  />
                  <span>Quero receber novidades e ofertas por e-mail. Posso cancelar quando quiser.</span>
                </label>
                <p className="mt-2">
                  Seu e-mail fica privado; apenas o nickname escolhido pode aparecer publicamente.
                </p>
              </div>
            </>
          )}

          {!forgotSent && !confirmationSent && authMode === 'forgot' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-800 mb-1 block">E-mail da sua Conta</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="seu@email.com"
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-medium border-2 border-black outline-none focus:bg-white"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Se este e-mail estiver cadastrado, enviaremos instruções de recuperação pelo provedor configurado.
              </p>
            </div>
          )}

          {!forgotSent && !confirmationSent && (
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-black text-white hover:bg-gray-800 border-2 border-black font-black text-xs uppercase tracking-wider rounded-xl shadow-[3px_4px_0px_0px_rgba(249,115,22,1)] active:translate-y-[2px] transition-all"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </span>
              ) : (
                <span>
                  {authMode === 'login' && 'Entrar na Conta'}
                  {authMode === 'register' && 'Cadastrar e Participar'}
                  {authMode === 'forgot' && 'Enviar Link de Recuperação'}
                </span>
              )}
            </Button>
          )}

          {authMode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full text-center text-xs font-bold text-gray-600 hover:text-black py-1"
            >
              ← Voltar para o Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

// Substituir o RulesModal por um modal de regras em etapas/carrossel
const rulesSteps = [
  {
    icon: <ListOrdered className="h-7 w-7 text-primary" />,
    title: 'Como Funciona',
    content: (
      <div className="space-y-2 text-sm text-black/80">
        <div className="font-semibold">Descubra a emoção de participar:</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Escolha seus números favoritos entre <b>1 e 99</b> e garanta sua participação em uma experiência inovadora de sorteios.</li>
          <li>Cada número representa uma chance real de vitória e custa apenas <b>1.000 satoshis</b> (0.00001000 BTC).</li>
          <li>O pagamento é realizado de forma simples, rápida e totalmente segura via Bitcoin.</li>
          <li>Após a confirmação, acompanhe o sorteio em tempo real e torça para ser o próximo vencedor.</li>
        </ul>
      </div>
    )
  },
  {
    icon: <Scale className="h-7 w-7 text-primary" />,
    title: 'Sorteio',
    content: (
      <div className="space-y-2 text-sm text-black/80">
        <div className="font-semibold">Transparência e imparcialidade garantidas:</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>O sorteio é realizado automaticamente assim que todos os números são vendidos, sem qualquer intervenção manual.</li>
          <li>O resultado é determinado pelo <b>hash do último bloco da blockchain Bitcoin</b>, assegurando aleatoriedade absoluta e auditabilidade pública.</li>
          <li>Os prêmios são creditados instantaneamente aos vencedores, reforçando nosso compromisso com agilidade e confiança.</li>
        </ul>
      </div>
    )
  },
  {
    icon: <Lock className="h-7 w-7 text-primary" />,
    title: 'Requisitos',
    content: (
      <div className="space-y-2 text-sm text-black/80">
        <div className="font-semibold">Participe com segurança e praticidade:</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tenha uma <b>carteira Bitcoin válida</b> para receber seus prêmios de forma rápida e segura.</li>
          <li>Certifique-se de possuir saldo suficiente para adquirir seus números (mínimo de <b>1.000 satoshis</b> por número).</li>
          <li>Mantenha seus dados atualizados para facilitar o contato e garantir o recebimento dos prêmios sem complicações.</li>
        </ul>
      </div>
    )
  },
  {
    icon: <AlertTriangle className="h-7 w-7 text-primary" />,
    title: 'Rollover e Saque de Prêmios',
    content: (
      <div className="space-y-2 text-sm text-black/80">
        <div className="font-semibold">Proteção, justiça e liberdade para todos:</div>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Rollover:</b> Apenas valores efetivamente apostados ficam disponíveis para saque, protegendo a plataforma contra abusos e promovendo um ambiente saudável para todos.</li>
          <li><b>Prêmios:</b> Ganhos obtidos em rifas podem ser sacados imediatamente, sem restrições. Seu lucro é sempre seu por direito!</li>
        </ul>
        <div>Essa política reforça a integridade, a transparência e a segurança da experiência para todos os participantes.</div>
      </div>
    )
  },
  {
    icon: <Star className="h-7 w-7 text-primary" />,
    title: 'Números da Sorte',
    content: (
      <div className="space-y-2 text-sm text-black/80">
        <div className="font-semibold">Prioridade exclusiva para vencedores recorrentes:</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ao conquistar uma vitória com determinado número, você garante o direito de reservar esse mesmo número em rifas futuras, ampliando suas chances de repetir a sorte.</li>
          <li>O total de reservas disponíveis corresponde ao número de vitórias obtidas com aquele número. Por exemplo: se você venceu 3 vezes com o número 7, poderá reservar o 7 em até 3 rifas futuras — sempre com prioridade sobre outros participantes.</li>
          <li><b>Importante:</b> A rifa atual permanece aberta a todos (exceto para números já reservados). O privilégio de reserva é válido exclusivamente para rifas futuras, nunca para a rodada em andamento.</li>
        </ul>
        <div>Essa regra reconhece e recompensa a sorte consistente, promovendo engajamento e oferecendo benefícios tangíveis aos participantes mais afortunados, sem comprometer a igualdade de oportunidades para novos jogadores.</div>
      </div>
    )
  }
];

const RulesModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [step, setStep] = useState(0);
  if (!isOpen) return null;
  const current = rulesSteps[step];
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-white to-gray-100 rounded-xl w-full max-w-md border-[4px] border-black shadow-[6px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group transition-all duration-200">
        <div className="p-6 flex flex-col min-h-[340px]">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Scroll className="w-5 h-5" />
              <h2 className="text-xl font-bold">Regras do Jogo</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Etapa atual */}
          <div className="flex flex-col items-center text-center flex-1 justify-center">
            <div className="mb-2">{current.icon}</div>
            <div className="text-lg font-semibold mb-2">{current.title}</div>
            <div
              className="w-full overflow-y-auto"
              style={{ maxHeight: '220px', minHeight: '120px', paddingRight: 4 }}
            >
              {current.content}
                      </div>
                      </div>

          {/* Navegação */}
          <div className="flex flex-col gap-2 mt-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {rulesSteps.map((_, idx) => (
                <span key={idx} className={`w-2 h-2 rounded-full transition-all duration-200 ${idx === step ? 'bg-primary' : 'bg-gray-300'}`}></span>
              ))}
                    </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
              >Anterior</Button>
              {step < rulesSteps.length - 1 ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => setStep(s => Math.min(rulesSteps.length - 1, s + 1))}
                >Próximo</Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={onClose}
                >Fechar</Button>
              )}
                  </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente do Monitor de Round Simplificado
const RoundMonitorModal = ({ isOpen, onClose, currentRound }: {
  isOpen: boolean;
  onClose: () => void;
  currentRound: RaffleRound | null;
}) => {
  if (!isOpen) return null;

  if (!currentRound) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Calcular estatísticas básicas
  const totalNumbers = currentRound.totalNumbers;
  const soldNumbers = currentRound.numbers.filter((n: RaffleNumber) => n.status === 'sold').length;
  const availableNumbers = totalNumbers - soldNumbers;
  const progress = (soldNumbers / totalNumbers) * 100;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-white border-[3px] border-black rounded-2xl shadow-[8px_10px_0px_0px_rgba(0,0,0,0.12)] max-w-md w-full p-0 overflow-hidden">
          {/* Header */}
        <div className="flex justify-between items-center border-b border-black/10 px-6 py-4">
              <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-black/70" />
            <span className="text-xl font-bold">Status do Round #{currentRound.roundNumber}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            className="rounded-full hover:bg-black/5 hover:text-destructive"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

        {/* Subtítulo */}
        <div className="px-6 pt-4 pb-2 text-base text-black font-semibold">
          Transparência em tempo real:
          <span className="block text-sm font-normal text-black/70">
            Acompanhe cada detalhe deste round exclusivo e não perca a chance de garantir sua participação.
          </span>
        </div>

        {/* Tempo */}
        <div className="px-6 pb-2">
          <span className="text-xs text-black/60">Aberto há:</span>
        <span className="font-bold text-lg text-black ml-2">
            {(() => {
              const start = currentRound.startDate
              if (!start) return '—'
              const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime()
              const diffMs = Math.max(0, Date.now() - startMs)
              const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
              const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
              return `${days} dia${days === 1 ? '' : 's'} e ${hours} hora${hours === 1 ? '' : 's'}`
            })()}
          </span>
        </div>

        {/* Progresso */}
        <div className="px-6 pb-4">
          <div className="flex justify-between text-xs text-black/60 mb-1">
            <span>Progresso da Rifa</span>
            <span className="font-bold text-black">{progress.toFixed(1)}%</span>
                      </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
              className="h-full bg-black transition-all duration-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                  </div>
                </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-3 px-6 pb-4">
          <div className="bg-gray-50 border border-black/10 rounded-lg p-3 text-center">
            <div className="text-xs text-black/60">Números vendidos</div>
            <div className="text-2xl font-extrabold text-black">{soldNumbers}</div>
                      </div>
          <div className="bg-gray-50 border border-black/10 rounded-lg p-3 text-center">
            <div className="text-xs text-black/60">Números disponíveis</div>
            <div className="text-2xl font-extrabold text-black">{availableNumbers}</div>
                    </div>
                  </div>

        {/* Prêmio */}
        <div className="px-6 pb-4">
          <div className="bg-gray-50 border border-black/10 rounded-lg p-3">
            <div className="text-xs text-black/60 mb-1">Prêmio Exclusivo</div>
            <div className="flex items-center gap-2 mb-1">
              <Bitcoin className="h-5 w-5 text-[#f7931a]" />
              <span className="text-lg font-bold">0.00080000 BTC</span>
                          </div>
            <div className="text-xs text-black/60 mt-1">
              O sorteio será realizado assim que todos os números forem vendidos.<br/>
              <span className="italic text-black/50">Acompanhe, participe e faça parte da elite dos vencedores.</span>
                              </div>
                          </div>
                        </div>

        {/* Motivação */}
        <div className="px-6 pb-6 text-sm text-black/70 italic text-center mt-4">
          Cada número é uma oportunidade única. Não deixe para depois — garanta já o seu!
        </div>
      </div>
    </div>
  );
};

// Novo componente de Dashboard para substituir a calculadora
const BitcoinDashboard = ({ btcPrice }: { btcPrice: number }) => {
  return (
    <div className="bg-white p-2.5 rounded-lg
      border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
      hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
      hover:translate-y-[1px]
      transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Dashboard</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-secondary/30 p-2 rounded-lg">
          <div className="text-xs text-black/70">Preço 24h</div>
          <div className="text-sm font-bold flex items-center">
            <span className="text-green-500">+2.4%</span>
            <ChevronRight className="h-3 w-3 text-green-500" />
          </div>
        </div>
        <div className="bg-secondary/30 p-2 rounded-lg">
          <div className="text-xs text-black/70">Volume</div>
          <div className="text-sm font-bold">Dados externos</div>
        </div>
      </div>

      <div className="bg-secondary/30 p-2 rounded-lg mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-black/70">Dominância</span>
          <span className="font-medium">Indisponível</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#f7931a]/80 to-[#f7931a] transition-all duration-500 rounded-full"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      <div className="text-xs text-center text-black/60">
        Cotação consultada em tempo real
      </div>
    </div>
  );
};

// Modal Completo de Rifas
const MyRafflesModal = ({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [currentFilter, setCurrentFilter] = useState<'all' | 'active' | 'waiting' | 'finished'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const allRaffles: Array<{ id: number; status: string; numbers: number[]; invested: number; result: string | null }> = [];

  const filteredRaffles = allRaffles.filter(raffle => {
    if (currentFilter === 'active') return raffle.status === 'active';
    if (currentFilter === 'waiting') return raffle.status === 'waiting';
    if (currentFilter === 'finished') return ['won', 'lost'].includes(raffle.status);
    return true;
  }).filter(raffle =>
    searchTerm === '' || raffle.id.toString().includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredRaffles.length / itemsPerPage);
  const currentRaffles = filteredRaffles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
      <Card className="w-full max-w-2xl max-h-[90vh] font-montserrat relative
        bg-white/95 border-[4px] border-black
        shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]
        rounded-xl overflow-hidden"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-secondary/30">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Minhas Rifas</h3>
                  <p className="text-sm text-muted-foreground">{filteredRaffles.length} rifas encontradas</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl hover:bg-black/5"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2">
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'active', label: 'Ativas' },
                  { key: 'waiting', label: 'Aguardando' },
                  { key: 'finished', label: 'Finalizadas' }
                ].map(filter => (
                  <Button
                    key={filter.key}
                    variant={currentFilter === filter.key ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setCurrentFilter(filter.key as any);
                      setCurrentPage(1);
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por número da rifa..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-secondary/40 rounded-lg bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Lista de Rifas */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {currentRaffles.map(raffle => (
                <div key={raffle.id} className="bg-white/50 p-3 rounded-lg border border-secondary/30 hover:bg-white/70 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">Rifa #{raffle.id}</span>
                      <div className="flex gap-1">
                        {raffle.numbers.map(num => (
                          <span key={num} className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded">
                            {num.toString().padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {raffle.invested.toFixed(8)} BTC
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        raffle.status === 'active' ? 'bg-green-100 text-green-700' :
                        raffle.status === 'waiting' ? 'bg-blue-100 text-blue-700' :
                        raffle.result === 'won' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {raffle.status === 'active' ? 'Ativa' :
                         raffle.status === 'waiting' ? 'Aguardando' :
                         raffle.result === 'won' ? 'Ganhou' : 'Perdeu'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-6 border-t border-secondary/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// Componente do Modal de Informações
const InfoModal = ({
  isOpen,
  onClose,
  btcPrice,
  calculateBRLValue,
  priceChangeDirection,
  isLoggedIn,
  userName,
  userBalance = 0,
  inGameBalance = 0,
  availableToWithdraw = 0,
  onLogin,
  onLogout,
}: {
  isOpen: boolean;
  onClose: () => void;
  btcPrice: number;
  calculateBRLValue: (amount: number) => string;
  priceChangeDirection: 'up' | 'down' | null;
  isLoggedIn: boolean;
  userName: string;
  userBalance?: number;
  inGameBalance?: number;
  availableToWithdraw?: number;
  onLogin: () => void;
  onLogout: () => void;
}) => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMyRafflesModal, setShowMyRafflesModal] = useState(false);

  const randomInfo = useMemo(() => {
    return magicSatsInfo[Math.floor(Math.random() * magicSatsInfo.length)];
  }, [isOpen]);

  const handleDeposit = () => {
    if (!isLoggedIn) {
      onLogin()
      return
    }
    setShowDepositModal(true);
  };

  const handleWithdraw = () => {
    if (!isLoggedIn) {
      onLogin()
      return
    }
    setShowWithdrawModal(true);
  };

  const handleTip = () => {
    if (!isLoggedIn) {
      onLogin()
      return
    }
    setShowTipModal(true);
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-background/95 to-background rounded-2xl w-full max-w-md
        shadow-2xl border-[4px] border-black relative animate-in fade-in-0 zoom-in-95">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">₿</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">Minha carteira</h2>
                <p className="text-sm text-gray-500">Consulta de saldos da conta</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <UserDashboard
              calculateBRLValue={calculateBRLValue}
              btcPrice={btcPrice}
              isLoggedIn={isLoggedIn}
              userName={userName}
              userBalance={userBalance}
              inGameBalance={inGameBalance}
              availableToWithdraw={availableToWithdraw}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onTip={handleTip}
              onSettings={handleSettings}
            />



            <BitcoinCard
              btcPrice={btcPrice}
              calculateBRLValue={calculateBRLValue}
              priceChangeDirection={priceChangeDirection}
            />

            {/* Informação Aleatória */}
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground">
                {randomInfo}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modais dos botões */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
      />
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableToWithdraw={availableToWithdraw}
      />
      <TipModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        userBalance={userBalance}
      />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isLoggedIn={isLoggedIn}
        onLogout={onLogout}
      />
      <MyRafflesModal
        isOpen={showMyRafflesModal}
        onClose={() => setShowMyRafflesModal(false)}
      />
    </div>
  );
};

// No início do componente BitcoinRaffleImproved
const VISITOR_STORAGE_KEY = 'ms_visitor_stats';

export function BitcoinRaffleImproved() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundAccess = useRoundAccess()
  const { user, isLoggedIn, login, register, logout } = useAuth()
  const { userProfile } = useSupabaseData()
  const userBalance = userProfile?.balance ?? 0
  const inGameBalance = userProfile?.in_game_balance ?? 0
  const availableToWithdraw = userBalance
  const [currentFaqIndex, setCurrentFaqIndex] = useState(0)
  const [selectedNumbersByRound, setSelectedNumbersByRound] = useState<{[key: string]: number[]}>({})
  const [activeRoundId, setActiveRoundId] = useState('round-1');
  const [rounds, setRounds] = useState<{[key: string]: any}>({})
  const [konamiCode, setKonamiCode] = useState<string[]>([])
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const [btcPrice, setBtcPrice] = useState<number>(0)
  const [visitors, setVisitors] = useState({ today: 0, total: 0 })
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isBtcLoading, setIsBtcLoading] = useState(true)
  const [showFAQ, setShowFAQ] = useState(false)
  const [isFaqTooltipOpen, setIsFaqTooltipOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [randomInfo, setRandomInfo] = useState(magicSatsInfo[0])
  const [previousBtcPrice, setPreviousBtcPrice] = useState<number>(0)
  const [priceChangeDirection, setPriceChangeDirection] = useState<'up' | 'down' | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [roundDataError, setRoundDataError] = useState<string | null>(null)
  const [unsubscribeToken, setUnsubscribeToken] = useState('')
  const [unsubscribeLoading, setUnsubscribeLoading] = useState(false)
  const [unsubscribeMessage, setUnsubscribeMessage] = useState('')
  const openRoundNumber = roundAccess.openRound ?? 1

  useEffect(() => {
    if (roundAccess.loading || roundAccess.openRound === null) return

    let active = true
    const requestedValue = searchParams.get('round')
    const requestedRound =
      requestedValue === null
        ? openRoundNumber
        : /^\d+$/.test(requestedValue)
          ? Number(requestedValue)
          : -1

    setIsLoading(true)
    setRoundDataError(null)
    void (async () => {
      try {
        let targetRound = requestedRound
        let access = await getRoundAccess(targetRound)
        if (!access.canView) {
          targetRound = openRoundNumber
          access = await getRoundAccess(targetRound)
          if (active) {
            toast({
              title: "Rifa ainda não disponível",
              description: "A rodada atual precisa terminar. Somente seu vencedor pode acessar a próxima antecipadamente.",
              variant: "destructive",
            })
            router.replace(`/rifa?round=${openRoundNumber}`)
          }
        }

        const roundsToLoad = [...new Set([openRoundNumber, targetRound])]
        const loadedRounds = await Promise.all(
          roundsToLoad.map((roundNumber) =>
            loadRoundFromDatabase(roundNumber, roundNumber === targetRound && access.earlyAccess),
          ),
        )
        if (!active) return

        setRounds((previous) => ({
          ...previous,
          ...Object.fromEntries(
            loadedRounds.map((round) => [`round-${round.roundNumber}`, round]),
          ),
        }))
        setActiveRoundId(`round-${targetRound}`)
        setSelectedNumbersByRound((previous) => ({
          ...previous,
          [`round-${targetRound}`]: previous[`round-${targetRound}`] ?? [],
        }))
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : "Não foi possível carregar a rifa."
        setRoundDataError(message)
      } finally {
        if (active) setIsLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [roundAccess.loading, roundAccess.openRound, openRoundNumber, searchParams, user?.id, router, toast])

  useEffect(() => {
    const match = window.location.hash.match(/^#unsubscribe=([a-f0-9]{64})$/)
    if (!match) return
    setUnsubscribeToken(match[1])
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }, [])

  const confirmUnsubscribe = async () => {
    if (!unsubscribeToken) return
    setUnsubscribeLoading(true)
    setUnsubscribeMessage('')
    try {
      const result = await unsubscribeFromMarketing({ data: { token: unsubscribeToken } })
      setUnsubscribeMessage(result.message)
      setUnsubscribeToken('')
    } catch {
      setUnsubscribeMessage('Não foi possível atualizar a preferência. Tente novamente mais tarde.')
    } finally {
      setUnsubscribeLoading(false)
    }
  }

  useEffect(() => {
    setRandomInfo(magicSatsInfo[Math.floor(Math.random() * magicSatsInfo.length)])
  }, [])

  useEffect(() => {
    const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

    const handleKeyDown = (event: KeyboardEvent) => {
      setKonamiCode(prev => {
        const newCode = [...prev, event.key]
        if (newCode.length > konamiSequence.length) {
          newCode.shift()
        }

        if (newCode.join(',') === konamiSequence.join(',')) {
          setShowEasterEgg(true)
          setTimeout(() => setShowEasterEgg(false), 5000)
          return []
        }

        return newCode
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const fetchBtcPrice = async () => {
      setIsBtcLoading(true)
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl')
        const data = await response.json()
        const newPrice = data.bitcoin.brl

        if (btcPrice > 0) {
          setPreviousBtcPrice(btcPrice)
          setPriceChangeDirection(newPrice > btcPrice ? 'up' : 'down')
        }

        setBtcPrice(newPrice)

        setTimeout(() => {
          setPriceChangeDirection(null)
        }, 1000)
      } catch (error) {
        console.error(error)
      } finally {
        setIsBtcLoading(false)
      }
    }

    fetchBtcPrice()
    const interval = setInterval(fetchBtcPrice, 30000)
    return () => clearInterval(interval)
  }, [btcPrice])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(VISITOR_STORAGE_KEY) || '{}') as { date?: string; today?: number; total?: number }
      const today = new Date().toISOString().slice(0, 10)
      const next = {
        today: stored.date === today ? (stored.today || 0) + 1 : 1,
        total: (stored.total || 0) + 1,
      }
      localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify({ ...next, date: today }))
      setVisitors(next)
    } catch {
      setVisitors({ today: 1, total: 1 })
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menuElement = document.getElementById('floating-menu')
      const menuButton = document.getElementById('menu-trigger')

      if (isMenuOpen &&
          menuElement &&
          !menuElement.contains(event.target as Node) &&
          !menuButton?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  // Adicionar useEffect para controlar steps
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length)
    }, 3000) // Muda a cada 3 segundos

    return () => clearInterval(timer)
  }, [])

  const toggleNumber = (number: number) => {
    const currentRound = rounds[activeRoundId]
    if (!currentRound || currentRound.roundNumber !== openRoundNumber || currentRound.status !== 'active') return

    const raffleNumber = currentRound.numbers.find((n: RaffleNumber) => n.number === number)
    if (!raffleNumber || raffleNumber.status !== 'available') return

    setSelectedNumbersByRound(prev => ({
      ...prev,
      [activeRoundId]: prev[activeRoundId]?.includes(number)
        ? prev[activeRoundId].filter(n => n !== number)
        : [...(prev[activeRoundId] || []), number]
    }))
  }

  const handlePayWithBalance = async () => {
    const selectedNumbers = selectedNumbersByRound[activeRoundId] || []
    if (selectedNumbers.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um número",
        variant: "destructive",
      })
      return
    }

    // Verificar se o usuário está logado
    if (!isLoggedIn) {
      setShowAuthModal(true)
      return
    }

    const currentRound = rounds[activeRoundId]
    if (
      !currentRound ||
      currentRound.roundNumber !== openRoundNumber ||
      currentRound.status !== 'active'
    ) {
      toast({
        title: "Rifa indisponível",
        description: "Os números só podem ser solicitados na rodada ativa.",
        variant: "destructive",
      })
      return
    }

    // Pagamento direto pelo site via saldo da carteira (BTCPay Server — integração pendente)
    toast({
      title: "Pagamento em breve",
      description: "O pagamento com saldo da carteira (BTCPay Server) será ativado em breve. Seus números ainda não foram reservados.",
    })
  }

  const handleLoginSuccess = () => {
    setSelectedNumbersByRound({})
  }

  const handleScheduleLuckyNumber = async (number: number) => {
    if (!user) {
      setShowAuthModal(true)
      return
    }

    const targetRound = openRoundNumber + 1
    if (
      !roundAccess.nextRoundAccess?.earlyAccess ||
      roundAccess.nextRoundAccess.allowedNumber !== number
    ) {
      toast({
        title: "Reserva não autorizada",
        description: "Somente o vencedor da rodada atual pode reservar o mesmo número na próxima.",
        variant: "destructive",
      })
      return
    }

    try {
      const { data: claimedNumber, error } = await supabase.rpc('claim_winner_number', {
        target_round: targetRound,
      })
      if (error || claimedNumber !== number) {
        throw new Error("Não foi possível confirmar a reserva. Atualize a página e tente novamente.")
      }

      const { data: soldNumbers, error: soldError } = await supabase.rpc('get_sold_numbers', {
        target_round: targetRound,
      })
      if (soldError) throw new Error("A reserva foi feita, mas não foi possível atualizar a lista de números.")

      setRounds((previous) => {
        const target = previous[`round-${targetRound}`]
        if (!target) return previous
        const sold = new Set(soldNumbers ?? [])
        return {
          ...previous,
          [`round-${targetRound}`]: {
            ...target,
            numbers: target.numbers.map((raffleNumber: RaffleNumber) => ({
              ...raffleNumber,
              status: sold.has(raffleNumber.number) ? 'sold' : raffleNumber.status,
            })),
          },
        }
      })
      await roundAccess.refresh()
      toast({ title: 'Número reservado', description: `O número ${number} foi garantido na rodada #${targetRound}.` })
    } catch (error) {
      toast({
        title: 'Não foi possível reservar o número',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const calculateBRLValue = (btcAmount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(btcAmount * btcPrice)
  }

  const renderNumberBlock = (start: number, end: number) => {
    const currentRound = rounds[activeRoundId]
    if (!currentRound) return null

    const selectedNumbers = selectedNumbersByRound[activeRoundId] || []

    return (
      <div className="grid grid-cols-5 gap-1 p-2 bg-secondary rounded-lg">
        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(number => {
          const raffleNumber = currentRound.numbers.find((n: RaffleNumber) => n.number === number)
          if (!raffleNumber) return null

          const isPurchased = raffleNumber.status === 'sold'

          if (isPurchased) {
            return (
              <div key={number} className="flex items-center justify-center">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-14 w-14 p-0 font-medium
                          bg-gradient-to-b from-zinc-100 to-zinc-200
                          border-[4px] border-zinc-300
                          shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
                          translate-x-[4px] translate-y-[6px]
                          text-zinc-400
                          cursor-not-allowed
                          relative
                          rounded-xl
                          before:content-[''] before:absolute before:inset-0
                          before:bg-gradient-to-br before:from-white/40 before:to-transparent
                          before:rounded-lg
                          hover:before:opacity-50
                          transition-all duration-300
                          animate-sold"
                        onClick={(e) => {
                          e.preventDefault()
                        }}
                      >
                        <span className="relative z-10 flex items-center justify-center w-full h-full text-[16.5px]">
                          {number}
                        </span>
                        <span className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/5 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg"></span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      className="bg-popover/90 backdrop-blur-sm border shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 rounded-xl"
                      sideOffset={5}
                    >
                      <div className="text-center p-1">
                        <p className="font-medium text-zinc-800 mb-1">
                          {raffleNumber.legacyPurchase?.name || 'Anônimo'}
                        </p>
                        {raffleNumber.legacyPurchase?.ddd && (
                          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <span>🇧</span>
                              <span>{raffleNumber.legacyPurchase.ddd}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )
          }

          return (
            <div key={number} className="flex items-center justify-center">
              <Button
                variant="outline"
                className={`h-14 w-14 p-0 font-medium border-[4px] transition-all duration-200 relative overflow-hidden rounded-xl text-[16.5px]
                  ${
                    selectedNumbers.includes(number)
                      ? `
                        bg-gradient-to-b from-green-200 to-green-300
                        border-green-500
                        shadow-[2px_2px_0px_0px_rgba(34,197,94,0.5)]
                        translate-x-[4px] translate-y-[6px]
                        text-green-700
                        before:content-[''] before:absolute before:inset-0 before:bg-white/10
                        before:rounded-lg
                        after:content-[''] after:absolute after:bottom-[-4px] after:left-[8px] after:right-[8px] after:h-[2px] after:bg-green-600/20 after:rounded-full
                        animate-glow
                      `
                      : `
                        bg-gradient-to-b from-white to-gray-100
                        border-black
                        shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
                        hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
                        hover:translate-y-[2px]
                        active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                        active:translate-y-[6px]
                        hover:before:animate-shine
                        before:absolute before:inset-0
                        before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent
                        before:rounded-lg
                        before:-translate-x-full before:animate-none before:hover:animate-shine
                      `
                  }
                  [&>.ripple]:absolute [&>.ripple]:bg-white/30 [&>.ripple]:rounded-full [&>.ripple]:animate-ripple
                `}
                onClick={(e) => {
                  createRipple(e)
                  playKeySound(selectedNumbers.includes(number))
                  toggleNumber(number)
                }}
              >
                {number}
              </Button>
            </div>
          )
        })}
      </div>
    )
  }

  if (roundDataError || roundAccess.error) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-2xl border-4 border-black bg-white p-6 text-center shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]">
        <Shield className="mx-auto mb-3 h-8 w-8 text-orange-500" />
        <h2 className="text-xl font-black">Rifa temporariamente indisponível</h2>
        <p className="mt-2 text-sm text-gray-600">{roundDataError ?? roundAccess.error}</p>
        <Button
          className="mt-4"
          onClick={() => {
            setRoundDataError(null)
            void roundAccess.refresh().catch(() => undefined)
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (isLoading || roundAccess.openRound === null || Object.keys(rounds).length === 0) {
    return (
      <div className="flex justify-center my-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const currentRound = rounds[activeRoundId]
  if (!currentRound) {
    return <p className="py-12 text-center text-sm text-gray-600">Não foi possível carregar esta rodada.</p>
  }
  const selectedNumbers = selectedNumbersByRound[activeRoundId] || []
  const isNextRaffle = currentRound.roundNumber === openRoundNumber + 1
  const winningNumber = roundAccess.nextRoundAccess?.earlyAccess
    ? roundAccess.nextRoundAccess.allowedNumber
    : null
  const luckyNumbers: LuckyNumber[] =
    winningNumber === null || winningNumber === undefined
      ? []
      : [{
          number: winningNumber,
          victories: 1,
          reservationsLeft: roundAccess.nextRoundAccess?.numberClaimed ? 0 : 1,
        }]

  // Calcula estatísticas
  const totalSold = currentRound.numbers.filter((n: RaffleNumber) => n.status === 'sold').length
  const totalNumbers = currentRound.totalNumbers
  const percentageSold = ((totalSold / totalNumbers) * 100).toFixed(1)

  return (
    <>
      <Card className="w-full max-w-3xl mx-auto font-montserrat relative
        bg-white/95
        border-[4px] border-black
        shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]
        hover:shadow-[6px_8px_0px_0px_rgba(0,0,0,0.95)]
        transition-all duration-300
        rounded-xl
        overflow-hidden
        group
        backdrop-blur-sm
      ">
        <div className="relative bg-white/80 rounded-lg">
          <CardHeader className="relative z-10">
            <CardTitle className="text-center text-3xl font-bold mb-2">
              MagicSats ✨
            </CardTitle>
            <CardTitle className="text-center space-y-1">
              <div className="text-xl font-bold text-muted-foreground">
                RIFA DE BITCOINS
              </div>
              <div className="text-xl font-bold text-muted-foreground flex items-center justify-center gap-2">
                ROUND #{currentRound.roundNumber}
                {currentRound.roundNumber === 0 && (
                  <span className="text-[11px] font-semibold tracking-wide px-2 py-[2px] rounded-md border border-[#e6c98f] bg-[#f9f6ee] text-[#a88c3b] shadow-none uppercase" style={{letterSpacing: '0.04em', lineHeight: '1.1'}}>Arquivo</span>
                )}
                {currentRound.isUpcoming && (
                  <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-[2px] text-[10px] font-bold uppercase text-amber-800">
                    Prévia exclusiva
                  </span>
                )}
                {!currentRound.isUpcoming && currentRound.status === 'active' && (
                  <span className="inline-block align-middle w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              {isNextRaffle && roundAccess.nextRoundAccess?.earlyAccess && winningNumber !== null && (
                <div className="mx-auto mt-3 max-w-md rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-left">
                  <p className="text-sm font-bold text-amber-950">
                    Acesso antecipado: você venceu a rodada #{openRoundNumber}.
                  </p>
                  <p className="mt-1 text-xs text-amber-900">
                    Seu número vencedor {winningNumber} pode ser reservado uma vez para esta rodada.
                  </p>
                  <Button
                    className="mt-3 w-full"
                    disabled={roundAccess.nextRoundAccess.numberClaimed}
                    onClick={() => void handleScheduleLuckyNumber(winningNumber)}
                  >
                    {roundAccess.nextRoundAccess.numberClaimed ? "Número já reservado" : "Reservar meu número vencedor"}
                  </Button>
                </div>
              )}
              {/* Último Vencedor - discreto */}
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground font-normal">
                <span>Último Vencedor:</span>
                {currentRound.winners && currentRound.winners.length > 0 ? (
                  <>
                    {/* Bandeira do país (placeholder) */}
                    <span className="mr-1">🇧🇷</span>
                    {/* Nome do usuário ou endereço abreviado */}
                    <span className="font-mono">
                      {currentRound.winners[0].name
                        ? currentRound.winners[0].name
                        : `${currentRound.winners[0].address.slice(0, 6)}...${currentRound.winners[0].address.slice(-4)}`}
                  </span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 bg-secondary p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">PRÊMIO:</h2>
              {currentRound.roundNumber === 0 ? (
                // ⚠️ ROUND #0 - ARQUIVO HISTÓRICO - NUNCA ALTERAR ESTES VALORES! ⚠️
                // Mantido exatamente como estava para preservar credibilidade social
                // Múltiplos prêmios: 1º lugar + 2º lugar (diferente dos rounds futuros)
                // SEM informação de "valor por número" (diferente dos rounds futuros)
                <>
                  <p className="text-lg">🏆 0.00044000 BTC</p>
                  <p className="text-sm text-muted-foreground">(Quarenta e quatro mil Satoshis)</p>
                  <p className="text-lg">🥇 0.00040000 ₿</p>
                  <p className="text-lg">🥈 0.00004000 ₿</p>
                </>
              ) : (
                // Round #1+ - Nova configuração (template global)
                <>
                  <p className="text-lg">🏆 {Number(currentRound.prizePool).toFixed(8)} BTC</p>
                  <p className="text-sm text-muted-foreground">
                    ({Math.round(Number(currentRound.prizePool) * 100000000).toLocaleString('pt-BR')} satoshis)
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Números a {Number(currentRound.ticketPrice).toFixed(8)} BTC cada
                  </p>
                </>
              )}
            </div>

            {/* Botões de Navegação */}
            <div className="mb-6 md:hidden">
              <div className="grid grid-cols-5 gap-1 p-2 bg-secondary rounded-lg">
                {[
                  { icon: BarChart2, onClick: () => setShowStats(true) },
                  { icon: Scale, onClick: () => setShowFairness(true) },
                  { icon: Scroll, onClick: () => setShowRules(true) },
                  { icon: Timer, onClick: () => setShowMonitor(true) },
                  {
                    icon: Bitcoin,
                    onClick: () => setShowInfo(true),
                    className: `h-14 w-14 p-0 font-medium border-[4px] transition-all duration-300 relative overflow-hidden rounded-xl
                      bg-gradient-to-br from-[#f7931a] via-[#f7931a]/95 to-[#e68a00]
                      border-[#f7931a]
                      shadow-[6px_8px_0px_0px_rgba(247,147,26,0.6),inset_0px_1px_8px_rgba(255,255,255,0.4)]
                      hover:shadow-[4px_6px_0px_0px_rgba(247,147,26,0.5),inset_0px_1px_12px_rgba(255,255,255,0.5)]
                      hover:translate-y-[2px]
                      active:shadow-[2px_2px_0px_0px_rgba(247,147,26,0.4),inset_0px_1px_4px_rgba(255,255,255,0.3)]
                      active:translate-y-[6px]
                      group
                      animate-[glow_2s_ease-in-out_infinite]
                      before:absolute before:inset-0
                      before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent
                      before:translate-x-[-200%] before:animate-[shine_1.5s_ease-in-out_infinite]
                      before:skew-x-[-20deg]
                      after:absolute after:inset-0
                      after:bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.8),rgba(255,255,255,0.1))]
                      after:opacity-100
                      after:animate-[pulse_2s_ease-in-out_infinite]
                      hover:after:opacity-90
                      [&>.ripple]:absolute [&>.ripple]:bg-white/60 [&>.ripple]:rounded-full [&>.ripple]:animate-ripple
                      backdrop-blur-[2px]
                      hover:backdrop-blur-none
                      hover:bg-gradient-to-br hover:from-[#f7931a] hover:via-[#f7931a] hover:to-[#e68a00]
                      hover:border-[#f7931a]
                      hover:scale-[1.03]
                      hover:rotate-[0.5deg]
                      active:hover:scale-[0.98]
                      active:hover:rotate-0
                      ring-[1px] ring-white/30 ring-inset
                      hover:ring-white/40
                      active:ring-white/20
                      transition-all duration-300 ease-out
                      after:z-[1] before:z-[2]
                      overflow-hidden
                      bg-clip-padding
                      backdrop-filter
                      drop-shadow-[0_0_8px_rgba(247,147,26,0.3)]
                      hover:drop-shadow-[0_0_12px_rgba(247,147,26,0.4)]
                      active:drop-shadow-[0_0_15px_rgba(247,147,26,0.5)]
                      group-hover:animate-none
                      hover:animate-[glow-intense_2s_ease-in-out_infinite]
                      active:animate-[glow-press_0.2s_ease-out_forwards]
                      hover:after:animate-[pulse-intense_2s_ease-in-out_infinite]
                      hover:before:animate-[shine_1s_ease-in-out_infinite]
                      motion-safe:transition-all
                      motion-safe:duration-300
                    `
                  }
                ].map((button, index) => (
                  <div key={index} className="flex items-center justify-center">
                    <Button
                      variant="outline"
                      className={button.className || `h-14 w-14 p-0 font-medium border-[4px] transition-all duration-200 relative overflow-hidden rounded-xl
                        bg-gradient-to-b from-white to-gray-100
                        border-black
                        shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
                        hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
                        hover:translate-y-[2px]
                        active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                        active:translate-y-[6px]
                        hover:before:animate-shine
                        before:absolute before:inset-0
                        before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent
                        before:rounded-lg
                        before:-translate-x-full before:animate-none before:hover:animate-shine
                        [&>.ripple]:absolute [&>.ripple]:bg-white/30 [&>.ripple]:rounded-full [&>.ripple]:animate-ripple
                      `}
                      onClick={(e) => {
                        createRipple(e)
                        button.onClick?.()
                      }}
                    >
                      <button.icon className={`h-9 w-9 ${button.icon === Bitcoin ? 'text-white group-hover:scale-110 transition-transform' : ''}`} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {isLoading && (
              <div className="flex justify-center my-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 20, 40, 60, 80].map(start => (
                <div key={start}>
                  {renderNumberBlock(start + 1, Math.min(start + 20, 99))}
                </div>
              ))}

              {/* Botões de Navegação - Desktop */}
              <div className="hidden md:flex md:flex-col md:justify-start">
                <div className="grid grid-cols-5 gap-1 p-2 bg-secondary rounded-lg">
                  {[
                    { icon: BarChart2, onClick: () => setShowStats(true) },
                    { icon: Scale, onClick: () => setShowFairness(true) },
                    { icon: Scroll, onClick: () => setShowRules(true) },
                    { icon: Timer, onClick: () => setShowMonitor(true) },
                    {
                      icon: Bitcoin,
                      onClick: () => setShowInfo(true),
                      className: `h-14 w-14 p-0 font-medium border-[4px] transition-all duration-300 relative overflow-hidden rounded-xl
                        bg-gradient-to-br from-[#f7931a] via-[#f7931a]/95 to-[#e68a00]
                        border-[#f7931a]
                        shadow-[6px_8px_0px_0px_rgba(247,147,26,0.6),inset_0px_1px_8px_rgba(255,255,255,0.4)]
                        hover:shadow-[4px_6px_0px_0px_rgba(247,147,26,0.5),inset_0px_1px_12px_rgba(255,255,255,0.5)]
                        hover:translate-y-[2px]
                        active:shadow-[2px_2px_0px_0px_rgba(247,147,26,0.4),inset_0px_1px_4px_rgba(255,255,255,0.3)]
                        active:translate-y-[6px]
                        group
                        before:absolute before:inset-0
                        before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent
                        before:translate-x-[-200%] before:animate-[shine_1.5s_ease-in-out_infinite]
                        before:skew-x-[-20deg]
                        after:absolute after:inset-0
                        after:bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.8),rgba(255,255,255,0.1))]
                        after:opacity-100
                        hover:after:opacity-90
                        [&>.ripple]:absolute [&>.ripple]:bg-white/60 [&>.ripple]:rounded-full [&>.ripple]:animate-ripple
                        backdrop-blur-[2px]
                        hover:backdrop-blur-none
                        hover:bg-gradient-to-br hover:from-[#f7931a] hover:via-[#f7931a] hover:to-[#e68a00]
                        hover:border-[#f7931a]
                        hover:scale-[1.03]
                        hover:rotate-[0.5deg]
                        active:hover:scale-[0.98]
                        active:hover:rotate-0
                        ring-[1px] ring-white/30 ring-inset
                        hover:ring-white/40
                        active:ring-white/20
                        transition-all duration-300 ease-out
                        after:z-[1] before:z-[2]
                        overflow-hidden
                        bg-clip-padding
                        backdrop-filter
                      `
                    }
                  ].map((button, index) => (
                    <div key={index} className="flex items-center justify-center">
                      <Button
                        variant="outline"
                        className={button.className || `h-14 w-14 p-0 font-medium border-[4px] transition-all duration-200 relative overflow-hidden rounded-xl
                          bg-gradient-to-b from-white to-gray-100
                          border-black
                          shadow-[6px_8px_0px_0px_rgba(0,0,0,1)]
                          hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.8)]
                          hover:translate-y-[2px]
                          active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                          active:translate-y-[6px]
                          hover:before:animate-shine
                          before:absolute before:inset-0
                          before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent
                          before:rounded-lg
                          before:-translate-x-full before:animate-none before:hover:animate-shine
                          [&>.ripple]:absolute [&>.ripple]:bg-white/30 [&>.ripple]:rounded-full [&>.ripple]:animate-ripple
                        `}
                        onClick={(e) => {
                          createRipple(e)
                          button.onClick?.()
                        }}
                      >
                        <button.icon className={`h-9 w-9 ${button.icon === Bitcoin ? 'text-white group-hover:scale-110 transition-transform' : ''}`} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                aria-label="Pagar números selecionados com saldo"
                role="button"
                className="h-14 px-8 font-medium border-[4px] transition-all duration-200
                  bg-gradient-to-b from-green-500 to-green-600
                  border-green-700
                  shadow-[6px_8px_0px_0px_rgba(22,163,74,0.85)]
                  hover:shadow-[4px_6px_0px_0px_rgba(22,163,74,0.8)]
                  hover:translate-y-[2px]
                  active:shadow-[2px_2px_0px_0px_rgba(22,163,74,0.8)]
                  active:translate-y-[6px]
                  relative overflow-hidden
                  rounded-xl
                  text-white text-lg
                  group"
                onClick={handlePayWithBalance}
                disabled={
                  currentRound.roundNumber !== openRoundNumber ||
                  currentRound.status !== 'active' ||
                  selectedNumbers.length === 0
                }
              >
                <span className="relative z-10">
                  {selectedNumbers.length === 0 ? (
                    'Selecione seus números'
                  ) : (
                    `${selectedNumbers.length} número${selectedNumbers.length > 1 ? 's' : ''} - Round #${currentRound.roundNumber}`
                  )}
                </span>
                {/* Efeito de brilho */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
                  translate-x-[-200%] group-hover:animate-[shine_1s_ease-in-out_infinite]"
                />
              </Button>
            </div>

            <div className="mt-8 mb-4">
              <div className="w-full max-w-4xl mx-auto">
                <div className="relative bg-gradient-to-r from-secondary/40 via-secondary/60 to-secondary/40 rounded-lg overflow-hidden shadow-lg border border-border/50 group hover:border-border/80 transition-all duration-300">
                  <div className="relative w-full" style={{ paddingBottom: '20%' }}>
                    <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
                      <div className="text-center space-y-1 px-4">
                        <p className="text-sm font-medium text-primary/80 group-hover:text-primary transition-colors">
                          Espaço Publicitário Premium
                        </p>
                        <p className="text-xs text-muted-foreground/80">
                          Alcance milhares de entusiastas de Bitcoin • Anuncie Aqui
                        </p>
                      </div>
                    </div>
                    {/* Efeito de brilho hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div className="absolute inset-[-100%] animate-[shine_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </div>

        {/* Sombra interna sutil */}
        <div className="absolute inset-[4px] pointer-events-none rounded-lg
          shadow-[inset_0px_0px_4px_rgba(0,0,0,0.05)]"
        />
      </Card>

      {/* Modais */}
      <StatsCard
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        isLoggedIn={isLoggedIn}
        luckyNumbers={luckyNumbers}
        nextRoundNumber={openRoundNumber + 1}
        onLogin={() => setShowAuthModal(true)}
        onSchedule={handleScheduleLuckyNumber}
      />
      <FairnessCard isOpen={showFairness} onClose={() => setShowFairness(false)} />
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
      <RoundMonitorModal isOpen={showMonitor} onClose={() => setShowMonitor(false)} currentRound={currentRound} />
      <InfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        btcPrice={btcPrice}
        calculateBRLValue={calculateBRLValue}
        priceChangeDirection={priceChangeDirection}
        isLoggedIn={isLoggedIn}
        userName={userProfile?.username || user?.name || ''}
        userBalance={userBalance}
        inGameBalance={inGameBalance}
        availableToWithdraw={availableToWithdraw}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />

      {/* Modal do Menu Principal */}
      {isMainMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-md border-2 border-border relative animate-in fade-in-0 slide-in-from-top-5">
            {/* Conteúdo do menu aqui */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMainMenuOpen(false)}
              className="absolute right-2 top-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Autenticação */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
        login={login}
        register={register}
      />

      {(unsubscribeToken || unsubscribeMessage) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border-4 border-black bg-white p-6 text-center shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]">
            <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-emerald-600" />
            <h2 className="text-lg font-black">Preferências de e-mail</h2>
            {unsubscribeMessage ? (
              <p className="mt-3 text-sm text-gray-700">{unsubscribeMessage}</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-gray-700">
                  Deseja cancelar o recebimento de e-mails promocionais?
                </p>
                <Button
                  className="mt-4 w-full"
                  disabled={unsubscribeLoading}
                  onClick={() => void confirmUnsubscribe()}
                >
                  {unsubscribeLoading ? "Atualizando..." : "Cancelar e-mails promocionais"}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => {
                setUnsubscribeToken('')
                setUnsubscribeMessage('')
              }}
            >
              Fechar
            </Button>
          </div>
        </div>
      )}

    </>
  )
}
