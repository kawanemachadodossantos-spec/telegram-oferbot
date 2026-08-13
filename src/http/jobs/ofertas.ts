import axios from 'axios';
import * as cheerio from 'cheerio';
import { bot, group_id } from '../lib/bot';
import { getAssetPath, randomInt } from '../util/functions';

// ==========================================
// 1. SISTEMA DE POSTAGEM AUTOMÁTICA (TELEGRAM)
// ==========================================

const categorias = [
    { id: 18, nome: 'Computadores e Acessórios' },
    { id: 28, nome: 'Moda Masculina' },
    { id: 3, nome: 'Moda Feminina' },
    { id: 35, nome: 'Mercado e Pets' },
    { id: 20, nome: 'Casa e Cozinha' },
    { id: 13, nome: 'Brinquedos' },
    { id: 11, nome: 'Beleza e Cuidado Pessoal' },
    { id: 5, nome: 'Eletrônicos' },
    { id: 10, nome: 'Cuidados para o Bebê' },
    { id: 4, nome: 'Livros e Papelaria' },
    { id: 47, nome: 'Celulares e Dispositivos' },
    { id: 9, nome: 'Auto e Moto' },
    { id: 7, nome: 'Esportes e Lazer' },
    { id: 2, nome: 'Ofertas Locais' },
];

function gerarMensagemAutomatica ( categoria: any, desconto: number, linkOferta: string, linkCupom: string ) {
    const modelos = [
        `🚀 *OFERTA RELÂMPAGO NA SHOPEE* 🚀\n\n💰 Até *${desconto}\\% OFF* em *${categoria.nome}*\n\n🔗 [👉 ACESSE AQUI 👈](${linkOferta})\n🎟️ CUPOM: [👉 RESGATE AQUI 👈](${linkCupom})\n⚠️ Corre antes que acabe\\!`,
        `🔥 Olha só este baita desconto em *${categoria.nome}*\\! Até *${desconto}\\% OFF*\\.\n\n🔗 [👉 Dá uma olhada aqui 👈](${linkOferta})\n🎟️ Cupom: [👉 Pegue seu cupom aqui 👈](${linkCupom})\n⚠️ Não deixa passar, viu?`,
        `🌟 Oferta especial\\! *${desconto}\\% OFF* em *${categoria.nome}*\\.\n\n🔗 [👉 Vem ver 👈](${linkOferta})\n🎟️ Usa o cupom: [👉 Resgatar Cupom 👈](${linkCupom})\n⚠️ É só por pouco tempo\\!`,
    ];
    return modelos[Math.floor( Math.random() * modelos.length )];
}

function enviarMensagemAutomatica () {
    const categoria = categorias[Math.floor( Math.random() * categorias.length )];
    const desconto = randomInt( 50, 80 );
    
    // Seus links de afiliado
    const linkOferta = 'https://s.shopee.com.br/3qMGbbWn2G';
    const linkCupom = 'https://s.shopee.com.br/30mGe2PWLQ';

    const mensagem = gerarMensagemAutomatica( categoria, desconto, linkOferta, linkCupom );

    const chanceComBanner = Math.random() < 0.6;

    if ( chanceComBanner ) {
        const caminhoBanner = getAssetPath( 'shopee_banner.jpg' );
        bot.telegram.sendPhoto(
            +group_id,
            { source: caminhoBanner },
            { caption: mensagem, parse_mode: 'MarkdownV2' }
        )
            .then( () => console.log( '✅ Oferta enviada com banner' ) )
            .catch( err => console.error( '❌ Erro ao enviar oferta com banner:', err ) );
    } else {
        bot.telegram.sendMessage(
            +group_id,
            mensagem,
            { parse_mode: 'MarkdownV2' }
        )
            .then( () => console.log( '✅ Oferta enviada sem banner' ) )
            .catch( err => console.error( '❌ Erro ao enviar oferta sem banner:', err ) );
    }
}

// ==========================================
// 2. SISTEMA POR LINK PARA GERAR POST WHATSAPP
// ==========================================

const sessoesUsuario: { [key: number]: any } = {};

async function extrairDadosProduto(url: string) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        const nome = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Produto Oferta';
        const imagem = $('meta[property="og:image"]').attr('content') || '';

        let precoAtual = 'Consultar no site';
        let precoAnterior = 'Consultar no site';

        const priceMeta = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
        if (priceMeta) {
            precoAtual = parseFloat(priceMeta).toFixed(2).replace('.', ',');
        }

        return {
            nome: nome.trim(),
            preco: precoAtual,
            pa: precoAnterior,
            imagem,
            link: url
        };
    } catch (error) {
        console.error('Erro ao extrair dados do link:', error);
        return {
            nome: 'Produto em Oferta',
            preco: 'Confira no site',
            pa: 'Confira no site',
            imagem: '',
            link: url
        };
    }
}

function gerarTextoShopee(nome: string, pa: string, preco: string, par: string, link: string) {
    return `🛍️ ${nome}

~De R$ ${pa}~
🔥*Por R$ ${preco}*

💳 ${par}

🛒 Compre aqui 👉 ${link}

⚠️ *Preço e estoque sujeitos a alterações no site.*

⭐ *Oferta Exclusiva por Tempo Limitado!* Só para quem viu aqui 🤝

🎟️ *CUPONS DISPONÍVEIS AQUI:*
https://s.shopee.com.br/30mGe2PWLQ`;
}

function gerarTextoML(nome: string, pa: string, preco: string, cupom: string, link: string) {
    return `💥💥 *CUPOM DE DESCONTO* 💥💥

🛍️ ${nome}

~De R$ ${pa}~
💥 *Por R$ ${preco}*

🏷️ *Use o Cupom:* ${cupom}

🛒 Compre aqui 👉 ${link}

⚠️ *Promoção sujeita à alteração de preço e estoque do site*

⚠️🚨 *ATENÇÃO: Valor promocional apenas utilizando o Cupom de Desconto*`;
}

// Escutador de mensagens no Telegram
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;

    if (texto.startsWith('http://') || texto.startsWith('https://')) {
        await ctx.reply('🔍 *Lendo link do produto... Aguarde um instante.*', { parse_mode: 'Markdown' });

        const dados = await extrairDadosProduto(texto);
        sessoesUsuario[ctx.from.id] = dados;

        const mensagemPreview = `📦 *PRODUTO ENCONTRADO*\n\n📌 *Nome:* ${dados.nome}\n💰 *Preço:* R$ ${dados.preco}\n\nEscolha abaixo em qual formato deseja gerar o post para o WhatsApp:`;

        if (dados.imagem) {
            await ctx.replyWithPhoto(dados.imagem, {
                caption: mensagemPreview,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🛍️ Formato Shopee', callback_data: 'gerar_shopee' },
                            { text: '💥 Formato Mercado Livre', callback_data: 'gerar_ml' }
                        ],
                        [{ text: '🔴 Cancelar', callback_data: 'cancelar' }]
                    ]
                }
            });
        } else {
            await ctx.reply(mensagemPreview, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🛍️ Formato Shopee', callback_data: 'gerar_shopee' },
                            { text: '💥 Formato Mercado Livre', callback_data: 'gerar_ml' }
                        ],
                        [{ text: '🔴 Cancelar', callback_data: 'cancelar' }]
                    ]
                }
            });
        }
    }
});

// Ações dos botões Inline
bot.action('gerar_shopee', async (ctx) => {
    const dados = sessoesUsuario[ctx.from?.id || 0];
    if (!dados) {
        return ctx.reply('❌ Sessão expirada. Envie o link novamente.');
    }

    const textoFormatado = gerarTextoShopee(
        dados.nome,
        dados.pa,
        dados.preco,
        'ou até 3x sem juros',
        dados.link
    );

    await ctx.answerCbQuery('Texto Shopee Gerado!');
    await ctx.reply(`📱 *TEXTO SHOPEE PRONTO PARA O WHATSAPP:*\n\n\`\`\`\n${textoFormatado}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.action('gerar_ml', async (ctx) => {
    const dados = sessoesUsuario[ctx.from?.id || 0];
    if (!dados) {
        return ctx.reply('❌ Sessão expirada. Envie o link novamente.');
    }

    const textoFormatado = gerarTextoML(
        dados.nome,
        dados.pa,
        dados.preco,
        'CUPOM10',
        dados.link
    );

    await ctx.answerCbQuery('Texto Mercado Livre Gerado!');
    await ctx.reply(`📱 *TEXTO MERCADO LIVRE PRONTO PARA O WHATSAPP:*\n\n\`\`\`\n${textoFormatado}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.action('cancelar', async (ctx) => {
    await ctx.answerCbQuery('Cancelado.');
    await ctx.editMessageText('❌ *Operação cancelada.*', { parse_mode: 'Markdown' });
});

// Inicialização das tarefas agendadas
export function startOfertaJob () {
    const horas = 2;
    const intervaloMs = horas * 60 * 60 * 1000;

    enviarMensagemAutomatica();
    setInterval( enviarMensagemAutomatica, intervaloMs );
    console.log( '🔔 Job de ofertas e leitor de links iniciados...' );
}