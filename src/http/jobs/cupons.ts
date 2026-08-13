import fs from 'fs';
import path from 'path';
import { bot, group_id } from '../lib/bot';

const pastaCupons = path.join( __dirname, '..', '..', '..', 'assets' );

function lerArquivosDeImagem () {
    return fs.readdirSync( pastaCupons ).filter( file => file.endsWith( '.jpg' ) );
}

function escolherAleatorio ( lista: string[] ) {
    const index = Math.floor( Math.random() * lista.length );
    return lista[index];
}

function parsearNomeArquivo ( nomeArquivo: string ) {
    const [valor1, valor2] = nomeArquivo.replace( '.jpg', '' ).split( '_' );
    return { valor1, valor2 };
}

async function enviarCupomAleatorio () {
    const arquivos = lerArquivosDeImagem();
    if ( arquivos.length === 0 ) {
        console.warn( '⚠️ Nenhum arquivo encontrado na pasta assets!' );
        return;
    }

    const arquivoSorteado = escolherAleatorio( arquivos );
    const { valor1, valor2 } = parsearNomeArquivo( arquivoSorteado );
    
    // Link de afiliado atualizado
    const link = 'https://s.shopee.com.br/30mGe2PWLQ';

    const legenda = `
⚠️ *\\+CUPOM LIBERADO*

🎟 R$${valor1} OFF 
🎟 R$${valor2} OFF 

Resgate Aqui 👇
${link.replaceAll( '.', '\\.' )}
    `.trim();

    const caminhoImagem = path.join( pastaCupons, arquivoSorteado );

    try {
        await bot.telegram.sendPhoto(
            +group_id,
            { source: caminhoImagem },
            { caption: legenda, parse_mode: 'MarkdownV2' }
        );
        console.log( `✅ Cupom ${arquivoSorteado} enviado com sucesso!` );
    } catch ( error ) {
        console.error( `❌ Erro ao enviar ${arquivoSorteado}:`, error );
    }
}

export function startCupomJob () {
    console.log( '🔔 Job de cupons iniciado...' );

    const intervaloMinutos = 180;
    const intervaloMs = intervaloMinutos * 60 * 1000;

    enviarCupomAleatorio();
    setInterval( enviarCupomAleatorio, intervaloMs );
}