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
// 2. EXTRAÇÃO ROBUSTA DE DADOS DA SHOPEE E ML
// ==========================================

const sessoesUsuario: { [key: number]: any } = {};

// Função para seguir redirecionamentos e expandir o link final de afiliado
async function expandirUrl(urlOriginal: string): Promise<{ urlFinal: string, html: string, responseUrl: string }> {
    try {
        const res = await axios.get(urlOriginal, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9'
            },
            maxRedirects: 10,
            timeout: 12000
        });

        const urlFinal = res.request?.res?.responseUrl || res.config?.url || urlOriginal;
        return { urlFinal, html: res.data || '', responseUrl: urlFinal };
    } catch (e: any) {
        const urlFinal = e.response?.request?.res?.responseUrl || urlOriginal;
        return { urlFinal, html: e.response?.data || '', responseUrl: urlFinal };
    }
}

async function extrairDadosProduto(urlOriginal: string, precoManual?: string) {
    try {
        // 1. Expande o link curto de afiliado para pegar o HTML e a URL final
        const { urlFinal, html } = await expandirUrl(urlOriginal);

        // --- CAMADA A: MERCADO LIVRE (API OFICIAL) ---
        const mlMatch = urlFinal.match(/MLB-?(\d+)/i) || urlOriginal.match(/MLB-?(\d+)/i);
        if (mlMatch) {
            const itemId = `MLB${mlMatch[1]}`;
            try {
                const apiRes = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, { timeout: 8000 });
                if (apiRes.data) {
                    const item = apiRes.data;
                    const precoNum = precoManual ? parseFloat(precoManual.replace(',', '.')) : item.price;
                    const precoAtual = precoNum ? precoNum.toFixed(2).replace('.', ',') : 'Consultar no site';
                    
                    let precoAnterior = '';
                    if (item.original_price && item.original_price > item.price) {
                        precoAnterior = item.original_price.toFixed(2).replace('.', ',');
                    } else if (precoNum) {
                        precoAnterior = (precoNum * 1.25).toFixed(2).replace('.', ',');
                    } else {
                        precoAnterior = 'Consultar no site';
                    }

                    const imagem = item.pictures && item.pictures.length > 0 
                        ? item.pictures[0].secure_url || item.pictures[0].url 
                        : (item.thumbnail ? item.thumbnail.replace('-I.jpg', '-O.jpg') : '');

                    return {
                        nome: item.title || 'Produto em Oferta',
                        preco: precoAtual,
                        pa: precoAnterior,
                        imagem,
                        link: urlOriginal
                    };
                }
            } catch (err) {
                console.warn('Falha na API do ML, avançando para fallback...');
            }
        }

        // --- CAMADA B: SHOPEE API INTERNA (BUSCA POR ITEMID E SHOPID) ---
        const shopeeIds = urlFinal.match(/i\.(\d+)\.(\d+)/) || urlFinal.match(/\/product\/(\d+)\/(\d+)/);
        if (shopeeIds) {
            const shopid = shopeeIds[1];
            const itemid = shopeeIds[2];
            try {
                const apiShopee = await axios.get(`https://shopee.com.br/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 8000
                });

                if (apiShopee.data && apiShopee.data.data) {
                    const item = apiShopee.data.data;
                    const numPreco = precoManual ? parseFloat(precoManual.replace(',', '.')) : (item.price / 100000);
                    const precoAtual = !isNaN(numPreco) ? numPreco.toFixed(2).replace('.', ',') : 'Consultar no site';
                    const precoAnterior = item.price_before_discount > 0 
                        ? (item.price_before_discount / 100000).toFixed(2).replace('.', ',') 
                        : (!isNaN(numPreco) ? (numPreco * 1.25).toFixed(2).replace('.', ',') : 'Consultar no site');

                    return {
                        nome: item.name || 'Produto em Oferta',
                        preco: precoAtual,
                        pa: precoAnterior,
                        imagem: item.image ? `https://down-br.img.susercontent.com/file/${item.image}` : '',
                        link: urlOriginal
                    };
                }
            } catch (e) {
                console.warn('API interna da Shopee bloqueada, usando parser HTML...');
            }
        }

        // --- CAMADA C: PARSER HTML E JSON-LD DA PÁGINA ---
        const $ = cheerio.load(html);

        let nome = $('meta[property="og:title"]').attr('content') || 
                   $('meta[name="twitter:title"]').attr('content') || 
                   $('title').text() || 'Produto em Oferta';
        
        nome = nome.replace(/- Mercado Livre.*/i, '')
                   .replace(/\| Shopee Brasil.*/i, '')
                   .replace(/Compre.*na Shopee.*/i, '')
                   .trim();

        let imagem = $('meta[property="og:image"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content') || '';

        let precoAtual = precoManual || '';
        let precoAnterior = '';

        // Varre os scripts JSON-LD incorporados na página
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const json = JSON.parse($(el).html() || '{}');
                const items = Array.isArray(json) ? json : [json];
                for (const item of items) {
                    if (item.offers) {
                        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                        if (offer && offer.price) {
                            precoAtual = parseFloat(offer.price).toFixed(2).replace('.', ',');
                        }
                        if (offer && offer.highPrice) {
                            precoAnterior = parseFloat(offer.highPrice).toFixed(2).replace('.', ',');
                        }
                    }
                }
            } catch (e) {}
        });

        // Caso ainda não tenha achado o preço no JSON, busca nas Meta Tags de produto
        if (!precoAtual) {
            const priceMeta = $('meta[property="product:price:amount"]').attr('content') || 
                              $('meta[property="og:price:amount"]').attr('content') ||
                              $('meta[name="twitter:data1"]').attr('content');

            if (priceMeta) {
                const match = priceMeta.match(/[\d.,]+/);
                if (match) precoAtual = match[0].replace('.', ',');
            }
        }

        // Se encontrou o preço atual mas não o anterior, gera a estimativa "De R$"
        if (precoAtual && precoAtual !== 'Consultar no site' && !precoAnterior) {
            const numPreco = parseFloat(precoAtual.replace('.', '').replace(',', '.'));
            if (!isNaN(numPreco) && numPreco > 0) {
                precoAnterior = (numPreco * 1.25).toFixed(2).replace('.', ',');
            }
        }

        return {
            nome: nome || 'Produto em Oferta',
            preco: precoAtual || 'Consultar no site',
            pa: precoAnterior || 'Consultar no site',
            imagem,
            link: urlOriginal
        };

    } catch (error) {
        console.error('Erro na extração de dados:', error);
        return {
            nome: 'Produto em Oferta',
            preco: precoManual || 'Consultar no site',
            pa: 'Consultar no site',
            imagem: '',
            link: urlOriginal
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

// ==========================================
// 3. LISTENERS DO TELEGRAM BOT
// ==========================================

bot.on('text', async (ctx) => {
    const texto = ctx.message.text.trim();

    const partes = texto.split('|');
    const url = partes[0].trim();
    const precoInformado = partes[1] ? partes[1].trim() : undefined;

    if (url.startsWith('http://') || url.startsWith('https://')) {
        await ctx.reply('🔍 *Lendo link do produto... Aguarde um instante.*', { parse_mode: 'Markdown' });

        const dados = await extrairDadosProduto(url, precoInformado);
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

    if (dados.imagem) {
        await ctx.replyWithPhoto(dados.imagem, {
            caption: textoFormatado
        });
    } else {
        await ctx.reply(`📱 *TEXTO SHOPEE PRONTO PARA O WHATSAPP:*\n\n\`\`\`\n${textoFormatado}\n\`\`\``, { parse_mode: 'Markdown' });
    }
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

    if (dados.imagem) {
        await ctx.replyWithPhoto(dados.imagem, {
            caption: textoFormatado
        });
    } else {
        await ctx.reply(`📱 *TEXTO MERCADO LIVRE PRONTO PARA O WHATSAPP:*\n\n\`\`\`\n${textoFormatado}\n\`\`\``, { parse_mode: 'Markdown' });
    }
});

bot.action('cancelar', async (ctx) => {
    await ctx.answerCbQuery('Cancelado.');
    await ctx.editMessageText('❌ *Operação cancelada.*', { parse_mode: 'Markdown' });
});

export function startOfertaJob () {
    const horas = 2;
    const intervaloMs = horas * 60 * 60 * 1000;

    enviarMensagemAutomatica();
    setInterval( enviarMensagemAutomatica, intervaloMs );
    console.log( '🔔 Job de ofertas e leitor de links iniciados...' );
}
