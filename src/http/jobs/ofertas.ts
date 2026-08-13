import axios from 'axios';
import * as cheerio from 'cheerio';
import { bot } from '../lib/bot';

// Variável para armazenar temporariamente os dados extraídos da URL recebida
const sessoesUsuario: { [key: number]: any } = {};

// Função para extrair dados básicos do produto via Web Scraping
async function extrairDadosProduto(url: string) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Busca Título (Open Graph ou Tag Title)
        const nome = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Produto Oferta';
        
        // Busca Imagem (Open Graph)
        const imagem = $('meta[property="og:image"]').attr('content') || '';

        // Tenta encontrar preços na página (seletores genéricos para e-commerce)
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

// Formatos exatos para WhatsApp
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

// Escutador de mensagens com URLs no Telegram
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;

    // Verifica se a mensagem enviada contém um link
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

export function startOfertaJob() {
    console.log('🤖 Bot pronto para receber links no chat do Telegram!');
}
