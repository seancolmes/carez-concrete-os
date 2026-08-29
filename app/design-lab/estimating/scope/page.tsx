import Link from 'next/link';
import styles from '../../../design-lab.module.css';

const nav=[['H','Home'],['E','Estimate'],['J','Jobs'],['F','Field'],['$','Money']];
const scopeRows=[
  ['01','Foundations',true,false],
  ['01.10','Strip Footings',false,true],
  ['01.20','Pad Footings',false,true],
  ['02','Walls',false,false],
  ['02.10','Stem Walls',false,true],
  ['03','Slabs',false,false],
  ['03.10','Slab on Grade',false,true],
  ['03.20','Exterior Slabs',false,true],
  ['04','Site Concrete',false,false],
] as const;
const items=[
  ['Strip Footings','Takeoff · S1.0','18.2 CY','$9,884','$14,826','READY'],
  ['Pad Footings','Takeoff · S1.0','8.4 CY','$4,062','$6,093','READY'],
  ['Stem Walls','Takeoff · S2.1','22.7 CY','$14,230','$21,345','READY'],
  ['Grade Beams','Manual','11.6 CY','$6,510','$9,765','NEEDS REVIEW'],
  ['Equipment Pads','Takeoff · S3.0','4.8 CY','$2,754','$4,131','READY'],
] as const;

export default function EstimatingScopeDesign(){
  return <main className={styles.scopePage}>
    <aside className={styles.rail}>
      <Link href="/design-lab" className={styles.mark}>C</Link>
      <nav className={styles.railNav}>{nav.map(([abbr,label])=><div key={label} className={`${styles.railItem} ${label==='Estimate'?styles.railItemActive:''}`}><b>{abbr}</b><span>{label}</span></div>)}</nav>
    </aside>

    <aside className={styles.drawer}>
      <div className={styles.drawerKicker}>ESTIMATE</div>
      <h2>Morrison Residence</h2>
      <div className={styles.drawerDue}>Bid due Sep 04 · 2:00 PM</div>
      <nav className={styles.drawerNav}>
        <a>Scope</a><a>Takeoff</a><a>Pricing</a><a>Review</a><a>Proposal</a>
      </nav>
      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>ESTIMATE STATUS</div>
        <span className={styles.status}>IN PROGRESS</span>
        <div className={styles.drawerMeta}><span>Estimator</span><strong>Nik C.</strong></div>
      </div>
      <div className={styles.drawerTotals}>
        <span>TOTAL SELL</span>
        <strong>$184,720</strong>
        <small>Direct cost&nbsp; $123,146</small>
        <em>Gross margin&nbsp; 33.3%</em>
      </div>
    </aside>

    <section className={styles.workspace}>
      <header className={styles.topbar}>
        <strong>Scope</strong><span>/&nbsp;&nbsp; Morrison Residence</span><div className={styles.search}>⌕ Search / Command</div><div className={styles.avatar}>NC</div>
      </header>
      <div className={styles.content}>
        <div className={styles.heading}><h1>Estimate Scope</h1><p>Structure the bid by physical concrete scope before pricing. Keep quantity source and commercial lineage visible.</p></div>
        <div className={styles.tabs}>{['Scope','Takeoff','Pricing','Review','Proposal'].map(x=><div key={x} className={`${styles.tab} ${x==='Scope'?styles.tabActive:''}`}>{x}</div>)}</div>

        <div className={styles.workGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><span>SCOPE HIERARCHY</span><button className={styles.add}>+ Add</button></div>
            <div className={styles.scopeTree}>{scopeRows.map(([code,label,active,child])=><div key={code} className={`${styles.scopeRow} ${active?styles.scopeRowActive:''} ${child?styles.scopeChild:''}`}><span className={styles.scopeCode}>{code}</span><span>{label}</span><span>{child?'':'›'}</span></div>)}</div>
          </section>

          <section className={`${styles.panel} ${styles.detail}`}>
            <div className={styles.metrics}>
              <div className={styles.metric}><div className={styles.metricLabel}>Takeoff Quantity</div><div className={`${styles.metricValue} ${styles.metricValueProduction}`}>110.1 CY</div><div className={styles.metricSub}>Foundations</div></div>
              <div className={styles.metric}><div className={styles.metricLabel}>Direct Cost</div><div className={styles.metricValue}>$42,756</div></div>
              <div className={styles.metric}><div className={styles.metricLabel}>Sell</div><div className={`${styles.metricValue} ${styles.metricValueSell}`}>$64,134</div></div>
              <div className={styles.metric}><div className={styles.metricLabel}>Margin</div><div className={`${styles.metricValue} ${styles.metricValueMargin}`}>33.3%</div></div>
              <div className={styles.metric}><div className={styles.metricLabel}>Items</div><div className={styles.itemBadge}>6 ITEMS</div></div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Item</th><th>Source</th><th className={styles.num}>Prod Qty</th><th className={styles.num}>Direct</th><th className={styles.num}>Sell</th><th>Status</th></tr></thead>
                <tbody>{items.map(([item,source,prod,direct,sell,status])=><tr key={item}><td>{item}</td><td className={styles.source}>{source}</td><td className={`${styles.num} ${styles.prod}`}>{prod}</td><td className={`${styles.num} ${styles.direct}`}>{direct}</td><td className={`${styles.num} ${styles.sell}`}>{sell}</td><td><span className={status==='READY'?styles.ready:styles.review}>{status}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>;
}
