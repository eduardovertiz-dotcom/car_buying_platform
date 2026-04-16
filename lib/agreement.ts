export type AgreementData = {
  id: string;
  date: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    vin?: string;
    plate?: string;
  };
  buyer_name?: string;
  buyer_email?: string;
  seller_name?: string;
  seller_email?: string;
  price?: string;
  location?: string;
};

function or(v?: string): string {
  return v?.trim() || "Not provided";
}

export function generateAgreementHTML(data: AgreementData): string {
  const { id, date, vehicle } = data;
  const location = or(data.location);
  const buyer    = or(data.buyer_name);
  const seller   = or(data.seller_name);
  const price    = or(data.price);
  const vin      = vehicle.vin?.trim()   || "Not provided";
  const plate    = vehicle.plate?.trim() || "Not provided";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Contrato de Compraventa - MexGuardian</title>
<style>
body {
  font-family: Georgia, serif;
  max-width: 760px;
  margin: 60px auto;
  padding: 0 28px;
  color: #111;
  line-height: 1.75;
}
h1 {
  text-align: center;
  font-size: 22px;
  margin-bottom: 4px;
  letter-spacing: 0.3px;
}
.subtitle {
  text-align: center;
  font-size: 14px;
  color: #555;
  margin-bottom: 18px;
}
.meta, .ref {
  text-align: center;
  font-size: 12px;
  color: #666;
}
.section {
  margin-top: 30px;
}
h2 {
  font-size: 14px;
  margin-bottom: 8px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 4px;
  letter-spacing: 0.5px;
}
p {
  margin: 6px 0;
}
.vehicle-box {
  background: #f7f7f7;
  border: 1px solid #ddd;
  padding: 12px;
  margin-top: 10px;
}
.vehicle-box p {
  margin: 4px 0;
}
.sig {
  margin-top: 80px;
  display: flex;
  justify-content: space-between;
}
.sig-block {
  width: 45%;
}
.sig-line {
  border-top: 1px solid #111;
  margin-top: 50px;
  padding-top: 6px;
  text-align: center;
  font-size: 12px;
  color: #555;
}
.divider {
  margin: 60px 0;
  border-top: 2px dashed #ccc;
}
@media print {
  body { margin: 40px; }
}
</style>
</head>
<body>

<h1>CONTRATO DE COMPRAVENTA DE VEHÍCULO AUTOMOTOR</h1>
<p class="subtitle">MexGuardian — Registro de Transacción Verificada</p>
<p class="meta">${location}, ${date}</p>
<p class="ref">Referencia: ${id}</p>

<div class="section">
  <h2>I. PARTES</h2>
  <p><strong>VENDEDOR:</strong> ${seller}</p>
  <p><strong>COMPRADOR:</strong> ${buyer}</p>
</div>

<div class="section">
  <h2>II. OBJETO</h2>
  <div class="vehicle-box">
    <p><strong>Marca:</strong> ${vehicle.make}</p>
    <p><strong>Modelo:</strong> ${vehicle.model}</p>
    <p><strong>Año:</strong> ${vehicle.year}</p>
    <p><strong>VIN:</strong> ${vin}</p>
    <p><strong>Placas:</strong> ${plate}</p>
  </div>
</div>

<div class="section">
  <h2>III. PRECIO</h2>
  <p>$${price} MXN</p>
</div>

<div class="section">
  <h2>IV. DECLARACIONES</h2>
  <p>El VENDEDOR declara ser el legítimo propietario, que el vehículo no cuenta con reporte de robo y que se encuentra libre de gravámenes salvo lo indicado.</p>
  <p>El COMPRADOR declara haber revisado el vehículo y aceptar su estado.</p>
</div>

<div class="section">
  <h2>V. CONDICIÓN</h2>
  <p>El vehículo se vende en el estado en que se encuentra ("como está").</p>
</div>

<div class="section">
  <h2>VI. ENTREGA</h2>
  <p>El vendedor entrega factura, tarjeta de circulación y documentos disponibles en ${location}.</p>
</div>

<div class="section">
  <h2>VII. FUNDAMENTO LEGAL</h2>
  <p>Este contrato se celebra conforme al Código Civil Federal y legislación aplicable en México.</p>
</div>

<div class="section">
  <h2>VIII. JURISDICCIÓN</h2>
  <p>Las partes se someten a tribunales de ${location}.</p>
</div>

<div class="sig">
  <div class="sig-block">
    <div class="sig-line">VENDEDOR</div>
  </div>
  <div class="sig-block">
    <div class="sig-line">COMPRADOR</div>
  </div>
</div>

<div class="divider"></div>

<h1>Vehicle Purchase Agreement (Reference)</h1>
<p class="subtitle">MexGuardian — Verified Transaction Record</p>
<p class="meta">${location}, ${date}</p>
<p class="ref">Reference: ${id}</p>

<div class="section">
  <h2>PARTIES</h2>
  <p>Seller: ${seller}</p>
  <p>Buyer: ${buyer}</p>
</div>

<div class="section">
  <h2>VEHICLE</h2>
  <div class="vehicle-box">
    <p><strong>Make:</strong> ${vehicle.make}</p>
    <p><strong>Model:</strong> ${vehicle.model}</p>
    <p><strong>Year:</strong> ${vehicle.year}</p>
    <p><strong>VIN:</strong> ${vin}</p>
    <p><strong>Plates:</strong> ${plate}</p>
  </div>
</div>

<div class="section">
  <h2>PRICE</h2>
  <p>$${price} MXN</p>
</div>

<div class="section">
  <h2>TERMS</h2>
  <p>The vehicle is sold "as is". The seller transfers ownership and the buyer accepts the condition.</p>
</div>

<div class="section">
  <h2>JURISDICTION</h2>
  <p>${location}, Mexico</p>
</div>

<div class="sig">
  <div class="sig-block">
    <div class="sig-line">SELLER</div>
  </div>
  <div class="sig-block">
    <div class="sig-line">BUYER</div>
  </div>
</div>

<p style="margin-top:40px; font-size:12px; color:#777; text-align:center;">
Documento generado mediante MexGuardian como apoyo en una transacción vehicular.
</p>

<script>
window.onload = function() { window.focus(); window.print(); };
<\/script>

</body>
</html>`;
}
