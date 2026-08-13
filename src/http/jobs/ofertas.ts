import axios from 'axios';
import puppeteer from 'puppeteer';
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
// 2. EXTRAÇÃO COM NAVEGADOR REAL (PUPPETEER)
// ==========================================

const sessoesUsuario: { [key: number]: any } = {};

async function extrairComPuppeteer(url: string) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        // Navega até o link e aguarda a renderização completa dos componentes
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Extrai as informações diretamente do DOM rendered do navegador
        const dados = await page.evaluate(() => {
            // 1. Título / Nome
            let nome = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                       document.querySelector('h1')?.textContent ||
                       document.title || 'Produto em Oferta';

            nome = nome.replace(/- Mercado Livre.*/i, '')
                       .replace(/\| Shopee Brasil.*/i, '')
                       .replace(/Compre.*na Shopee.*/i, '')
                       .trim();

            // 2. Imagem
            const imagem = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                           document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';

            // 3. Preço Atual e Preço Anterior
            let precoAtual = '';
            let precoAnterior = '';

            // Estratégia Shopee
            const shopeePriceEl = document.querySelector('.pq8P23, ._179A9X, .f9q4iZ');
            if (shopeePriceEl) {
                precoAtual = shopeePriceEl.textContent?.replace('R$', '').trim() || '';
            }

            // Estratégia Mercado Livre
            if (!precoAtual) {
                const mlPriceFrac = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction')?.textContent;
                const mlPriceCents = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__cents')?.textContent;
                if (mlPriceFrac) {
                    precoAtual = mlPriceCents ? `${mlPriceFrac},${mlPriceCents}` : mlPriceFrac;
                }
            }

            // Estratégia Meta Tag Generica
            if (!precoAtual) {
                const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                                  document.querySelector('meta[property="og:price:amount"]')?.getAttribute('content');
                if (metaPrice) {
                    const match = metaPrice.match(/[\d.,]+/);
                    if (match) precoAtual = match[0].replace('.', ',');
                }
            }

            return { nome, imagem, precoAtual, precoAnterior };
        });

        await browser.close();
        return dados;

    } catch (err) {
        console.error('Erro no Puppeteer:', err);
        if (browser) await browser.close();
        return null;
    }
}

async function extrairDadosProduto(urlOriginal: string, precoManual?: string) {
    try {
        // A. Mercado Livre (Tentativa rápida via API pública)
        const mlMatch = urlOriginal.match(/MLB-?(\d+)/i);
        if (mlMatch) {
            const itemId = `MLB${mlMatch[1]}`;
            try {
                const apiRes = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, { timeout: 6000 });
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
                console.warn('API ML falhou, acionando Puppeteer...');
            }
        }

        // B. Leitura completa via Puppeteer (Abrindo a página como navegador real)
        const dadosPuppeteer = await extrairComPuppeteer(urlOriginal);

        let precoFinal = precoManual || dadosPuppeteer?.precoAtual || 'Consultar no site';
        let precoAnteriorFinal = 'Consultar no site';

        if (precoFinal !== 'Consultar no site') {
            const numPreco = parseFloat(precoFinal.replace('.', '').replace(',', '.'));
            if (!isNaN(numPreco) && numPreco > 0) {
                precoAnteriorFinal = (numPreco * 1.25).toFixed(2).replace('.', ',');
            }
        }

        return {
            nome: dadosPuppeteer?.nome || 'Produto em Oferta',
            preco: precoFinal,
            pa: precoAnteriorFinal,
            imagem: dadosPuppeteer?.imagem || '',
            link: urlOriginal
        };

    } catch (error) {
        console.error('Erro geral ao extrair dados:', error);
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
        await ctx.reply('🔍 *Abrindo o link no navegador para extrair preço e foto... Aguarde alguns segundos.*', { parse_mode: 'Markdown' });

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