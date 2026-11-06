/**
 * Diagramas de la dinámica de sistemas en SVG: causal (con los bucles nombrados) y de Forrester
 * (stocks, flujos con válvula, nubes y variables auxiliares). Colores por tokens CSS.
 */

function Nodo({ x, y, texto, ancho = 132, tono = 'placa' }: { x: number; y: number; texto: string; ancho?: number; tono?: 'placa' | 'stock' | 'politica' }) {
  return (
    <g className={`dg-nodo dg-${tono}`}>
      <rect x={x - ancho / 2} y={y - 17} width={ancho} height={34} rx={6} />
      <text x={x} y={y + 5} textAnchor="middle">
        {texto}
      </text>
    </g>
  );
}

function Arco({ d, signo, lx, ly, punteado = false }: { d: string; signo: '+' | '−'; lx: number; ly: number; punteado?: boolean }) {
  return (
    <g className="dg-arco">
      <path d={d} markerEnd="url(#dg-flecha)" strokeDasharray={punteado ? '5 4' : undefined} />
      <circle cx={lx} cy={ly} r={9} className={signo === '+' ? 'dg-signo-mas' : 'dg-signo-menos'} />
      <text x={lx} y={ly + 4} textAnchor="middle" className="dg-signo">
        {signo}
      </text>
    </g>
  );
}

function Bucle({ x, y, nombre, tipo }: { x: number; y: number; nombre: string; tipo: 'R' | 'B' }) {
  return (
    <g className={`dg-bucle dg-bucle-${tipo}`}>
      <path d={`M ${x + 15} ${y - 6} A 16 16 0 1 0 ${x + 16} ${y + 4}`} markerEnd="url(#dg-flecha-chica)" />
      <text x={x} y={y + 5} textAnchor="middle">
        {nombre}
      </text>
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="dg-flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="dg-punta" />
      </marker>
      <marker id="dg-flecha-chica" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="dg-punta" />
      </marker>
    </defs>
  );
}

export function DiagramaCausal() {
  return (
    <svg className="diagrama" viewBox="0 0 820 420" role="img" aria-label="Diagrama causal: bucle de refuerzo R1 por ausentismo y reingresos; bucles de balance B1 por desaliento, B2 por consumo de turnos y B3 por la política adaptativa">
      <Defs />
      {/* Bucle R1: L → a → p → reingresos → L */}
      <Arco d="M 330 214 Q 420 170 452 150" signo="+" lx={402} ly={168} />
      <Arco d="M 606 150 Q 668 178 676 222" signo="+" lx={668} ly={186} />
      <Arco d="M 650 262 Q 620 318 560 330" signo="+" lx={624} ly={312} />
      <Arco d="M 452 332 Q 350 316 312 250" signo="+" lx={360} ly={306} />
      {/* Capacidad → anticipación */}
      <Arco d="M 528 72 L 528 114" signo="−" lx={544} ly={94} />
      {/* Bucle B1: a → desaliento → demanda efectiva → L */}
      <Arco d="M 452 122 Q 380 70 322 66" signo="+" lx={384} ly={78} />
      <Arco d="M 206 66 Q 150 76 132 108" signo="−" lx={150} ly={78} />
      <Arco d="M 130 160 Q 150 214 186 222" signo="+" lx={146} ly={200} />
      {/* Bucle B2: L ⇄ consumo */}
      <Arco d="M 236 252 Q 210 300 200 330" signo="+" lx={208} ly={292} />
      <Arco d="M 152 334 Q 120 290 186 246" signo="−" lx={138} ly={296} />
      {/* Bucle B3: p observado → k → C */}
      <Arco d="M 728 216 Q 770 130 744 74" signo="+" lx={762} ly={140} punteado />
      <Arco d="M 680 52 L 602 54" signo="+" lx={640} ly={42} />

      <Nodo x={256} y={232} texto="Lista de espera L" ancho={150} tono="stock" />
      <Nodo x={528} y={136} texto="Anticipación a" />
      <Nodo x={528} y={52} texto="Capacidad C" />
      <Nodo x={690} y={242} texto="Ausentismo p" />
      <Nodo x={506} y={338} texto="Reingresos" ancho={110} />
      <Nodo x={264} y={58} texto="Desaliento" ancho={116} />
      <Nodo x={124} y={134} texto="Demanda efectiva" ancho={148} />
      <Nodo x={176} y={350} texto="Consumo S" ancho={116} />
      <Nodo x={740} y={52} texto="Sobreturnos k" tono="politica" ancho={130} />

      <Bucle x={476} y={250} nombre="R1" tipo="R" />
      <Bucle x={276} y={140} nombre="B1" tipo="B" />
      <Bucle x={150} y={250} nombre="B2" tipo="B" />
      <Bucle x={680} y={140} nombre="B3" tipo="B" />
    </svg>
  );
}

function Stock({ x, y, w, h, texto, sub }: { x: number; y: number; w: number; h: number; texto: string; sub?: string }) {
  return (
    <g className="dg-stock-f">
      <rect x={x} y={y} width={w} height={h} rx={3} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 5)} textAnchor="middle" className="dg-stock-texto">
        {texto}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" className="dg-sub">
          {sub}
        </text>
      )}
    </g>
  );
}

function Valvula({ x, y, texto, abajo = false }: { x: number; y: number; texto: string; abajo?: boolean }) {
  return (
    <g className="dg-valvula">
      <path d={`M ${x - 9} ${y - 9} L ${x + 9} ${y + 9} L ${x + 9} ${y - 9} L ${x - 9} ${y + 9} Z`} />
      <text x={x} y={abajo ? y + 28 : y - 16} textAnchor="middle" className="dg-sub">
        {texto}
      </text>
    </g>
  );
}

function Nube({ x, y }: { x: number; y: number }) {
  return <path className="dg-nube" d={`M ${x - 18} ${y + 8} a 9 9 0 0 1 2 -17 a 11 11 0 0 1 20 -4 a 9 9 0 0 1 14 12 a 8 8 0 0 1 -4 13 z`} />;
}

function Aux({ x, y, texto }: { x: number; y: number; texto: string }) {
  return (
    <g className="dg-aux">
      <circle cx={x} cy={y} r={20} />
      <text x={x} y={y + 4} textAnchor="middle">
        {texto}
      </text>
    </g>
  );
}

export function DiagramaForrester() {
  const tubo = (d: string) => <path className="dg-tubo" d={d} />;
  const info = (d: string) => <path className="dg-info" d={d} markerEnd="url(#dg-flecha-chica)" />;
  return (
    <svg className="diagrama" viewBox="0 0 820 340" role="img" aria-label="Diagrama de Forrester: la demanda entra a la lista de espera o se desalienta; el consumo de turnos sale hacia atendidos, ausentes perdidos o reingresa a la lista">
      <Defs />
      {/* Ingreso a la lista y desaliento */}
      <Nube x={44} y={150} />
      {tubo('M 62 150 L 250 150')}
      <Valvula x={150} y={150} texto="ingreso D·(1−d)" />
      {tubo('M 120 150 L 120 64 L 250 64')}
      <Valvula x={180} y={64} texto="desaliento D·d" />
      <Stock x={250} y={42} w={130} h={44} texto="Desalentados" />
      <Stock x={250} y={120} w={150} h={60} texto="Lista de espera L" sub="pacientes" />
      {/* Consumo y destinos */}
      {tubo('M 400 150 L 520 150')}
      <Valvula x={460} y={150} texto="consumo S" />
      {tubo('M 520 150 L 520 64 L 640 64')}
      {tubo('M 520 150 L 640 150')}
      {tubo('M 520 150 L 520 236 L 640 236')}
      <Valvula x={580} y={64} texto="S·(1−p)" />
      <Valvula x={580} y={150} texto="(1−r)·S·p" />
      <Stock x={640} y={42} w={140} h={44} texto="Atendidos" />
      <Stock x={640} y={128} w={140} h={44} texto="Ausentes perdidos" />
      {tubo('M 640 236 L 330 236 L 330 180')}
      <Valvula x={480} y={236} texto="reingreso r·S·p" abajo />
      {/* Variables auxiliares y vínculos de información */}
      <Aux x={300} y={296} texto="a" />
      <Aux x={430} y={296} texto="C" />
      <Aux x={600} y={296} texto="p" />
      <Aux x={150} y={250} texto="d" />
      {info('M 300 182 L 300 274')}
      {info('M 410 296 L 322 296')}
      {info('M 322 290 L 578 292')}
      {info('M 280 290 L 166 262')}
      {info('M 150 230 L 150 162')}
      {info('M 600 276 L 584 170')}
      {info('M 430 276 L 456 166')}
      <text x={430} y={334} textAnchor="middle" className="dg-sub">
        C = n·(N̄ + k)·dh/7 · a = L/C · p = p̄(a) · d = d(a)
      </text>
    </svg>
  );
}
