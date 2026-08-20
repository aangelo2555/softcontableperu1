const sunatDirectCpeService = require('../server/services/sunatDirectCpeService');

async function testMassZip() {
  const rucEmpresa = '20612314579';
  const usuarioSol = 'SQUATIOT';
  const claveSol = 'Mzaran206123';

  // 3 Comprobantes reales válidos
  const lista = [
    { rucEmisor: '20602701965', tipoCpe: '01', serie: 'FPP1', correlativo: '4053' },
    { rucEmisor: '20609396033', tipoCpe: '01', serie: 'F001', correlativo: '84' },
    { rucEmisor: '20615601587', tipoCpe: '01', serie: 'E001', correlativo: '258' }
  ];

  console.log('🧪 Probando generación de ZIP Masivo de XMLs...');
  const xmlZipBuffer = await sunatDirectCpeService.generarZipXmlLote({
    rucEmpresa,
    usuarioSol,
    claveSol,
    listaComprobantes: lista
  });
  console.log(`✅ ZIP XML generado! Tamaño: ${xmlZipBuffer.length} bytes`);

  console.log('🧪 Probando generación de ZIP Masivo de PDFs...');
  const pdfZipBuffer = await sunatDirectCpeService.generarZipPdfLote({
    rucEmpresa,
    usuarioSol,
    claveSol,
    listaComprobantes: lista
  });
  console.log(`✅ ZIP PDF generado! Tamaño: ${pdfZipBuffer.length} bytes`);
}

testMassZip().catch(err => console.error('❌ Error en prueba:', err));
