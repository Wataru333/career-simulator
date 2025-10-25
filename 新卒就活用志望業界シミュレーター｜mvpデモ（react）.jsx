import React, { useMemo, useState } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";

// ============================
// Color Tokens
// ============================
const COLORS = {
  turquoise: "#2EC4B6",
  yellow: "#FFD166",
  red: "#EF476F",
  navy: "#003049",
  white: "#FFFFFF",
};

// ============================
// 6 Axes (fixed order for radar)
// ============================
const AXES = ["growth", "collab", "autonomy", "stability", "worklife", "speed"] as const;
const AXIS_LABEL: Record<typeof AXES[number], string> = {
  growth: "成長意欲",
  collab: "協働力",
  autonomy: "裁量",
  stability: "安定",
  worklife: "ワークライフ",
  speed: "業務スピード",
};

// ============================
// Industry & Size Profiles (Draft from spec)
// ============================
// Vectors are [growth, collab, autonomy, stability, worklife, speed]
const INDUSTRY_PROFILE: Record<string, { base: number[]; sens: number[] }> = {
  メーカー: { base: [0.55, 0.60, 0.45, 0.75, 0.65, 0.40], sens: [1.00, 1.05, 0.90, 1.10, 1.00, 0.85] },
  コンサル: { base: [0.80, 0.55, 0.70, 0.35, 0.30, 0.85], sens: [1.20, 1.00, 1.15, 0.80, 0.75, 1.25] },
  商社:   { base: [0.65, 0.75, 0.60, 0.55, 0.45, 0.75], sens: [1.05, 1.15, 1.00, 0.95, 0.85, 1.10] },
  SIer:   { base: [0.50, 0.65, 0.40, 0.80, 0.70, 0.45], sens: [0.95, 1.05, 0.85, 1.10, 1.05, 0.90] },
  SE:     { base: [0.70, 0.60, 0.75, 0.55, 0.60, 0.80], sens: [1.10, 1.00, 1.20, 0.90, 0.95, 1.15] },
  広告:   { base: [0.75, 0.65, 0.70, 0.35, 0.40, 0.90], sens: [1.15, 1.05, 1.10, 0.80, 0.80, 1.25] },
  ベンチャー: { base: [0.85, 0.55, 0.85, 0.30, 0.30, 0.90], sens: [1.25, 0.95, 1.25, 0.75, 0.75, 1.30] },
};

const SIZE_PROFILE = [
  { label: "大手(1000+)",   d: [-0.05, +0.05, -0.10, +0.15, +0.10, -0.10], m: [0.95, 1.05, 0.90, 1.10, 1.05, 0.90] },
  { label: "中堅(100-999)", d: [ 0.00, +0.00, +0.00, +0.05, +0.00, +0.00], m: [1.00, 1.00, 1.00, 1.05, 1.00, 1.00] },
  { label: "小規模(~99)",    d: [ +0.10, -0.05, +0.15, -0.10, -0.10, +0.10], m: [1.10, 0.95, 1.15, 0.90, 0.90, 1.10] },
];

// ============================
// Question Set (4 per year x 3 years = 12)
// ============================
// Each option has partial weights on the 6 axes
const QUESTIONS: { id: string; year: 1|2|3; text: string; options: { label: string; w: Partial<Record<typeof AXES[number], number>> }[] }[] = [
  // Year 1
  { id: 'y1q1', year: 1, text: '研修で最も大事にしたいのは？', options: [
    { label: '同期との関わり', w: { collab: 1 } },
    { label: '先輩社員との関わり', w: { collab: 0.5, growth: 0.5 } },
    { label: '業務理解', w: { growth: 1 } },
  ]},
  { id: 'y1q2', year: 1, text: '学習スタイルは？', options: [
    { label: '座学で体系化', w: { stability: 1 } },
    { label: '現場同行で体得', w: { collab: 0.5, growth: 0.5 } },
    { label: '自習プロジェクトで試行', w: { autonomy: 1 } },
  ]},
  { id: 'y1q3', year: 1, text: '仕事の振られ方は？', options: [
    { label: '明確な指示で着実に', w: { stability: 1 } },
    { label: 'ざっくり方針で調整', w: { autonomy: 0.5, growth: 0.5 } },
    { label: '自分で提案して獲りに行く', w: { autonomy: 1 } },
  ]},
  { id: 'y1q4', year: 1, text: '残業への姿勢は？', options: [
    { label: '定時を基本に計画的に', w: { worklife: 1 } },
    { label: '必要時は柔軟に対応', w: { worklife: 0.5, growth: 0.5 } },
    { label: '成果のためなら延長可', w: { speed: 0.5, growth: 0.5, worklife: -0.5 } },
  ]},

  // Year 2
  { id: 'y2q1', year: 2, text: '難題に直面したとき？', options: [
    { label: 'まず周囲に相談', w: { collab: 1 } },
    { label: '自分で調査し提案', w: { growth: 0.5, autonomy: 0.5 } },
    { label: '上司に報告し方向確認', w: { stability: 1 } },
  ]},
  { id: 'y2q2', year: 2, text: '重視する評価軸は？', options: [
    { label: 'スピード', w: { speed: 1 } },
    { label: '品質の高さ', w: { growth: 1 } },
    { label: '再現可能な仕組み化', w: { stability: 1 } },
  ]},
  { id: 'y2q3', year: 2, text: '責任の広げ方は？', options: [
    { label: '任された範囲を堅実に', w: { stability: 1 } },
    { label: '周辺領域も巻き取る', w: { growth: 0.5, collab: 0.5 } },
    { label: '新領域を提案して創る', w: { autonomy: 1 } },
  ]},
  { id: 'y2q4', year: 2, text: '私生活の時間配分は？', options: [
    { label: '資格・学習に投資', w: { growth: 1 } },
    { label: '趣味・家族時間を確保', w: { worklife: 1 } },
    { label: '副業・個人PJに挑戦', w: { autonomy: 0.5, speed: 0.5 } },
  ]},

  // Year 3
  { id: 'y3q1', year: 3, text: '次に優先するのは？', options: [
    { label: '昇進・年収アップ', w: { speed: 0.5, growth: 0.5 } },
    { label: '専門性の深化', w: { growth: 1 } },
    { label: 'ワークライフの安定', w: { worklife: 1 } },
  ]},
  { id: 'y3q2', year: 3, text: '年収と勤務地のトレードオフなら？', options: [
    { label: '年収↑なら転居も可', w: { speed: 0.5, autonomy: 0.5, worklife: -0.5 } },
    { label: '同水準なら現状維持', w: { stability: 1 } },
    { label: '年収↓でも勤務地優先', w: { worklife: 1 } },
  ]},
  { id: 'y3q3', year: 3, text: '好みのチーム文化は？', options: [
    { label: '少数精鋭でスピード感', w: { speed: 0.5, growth: 0.5 } },
    { label: '大規模で役割明確', w: { stability: 1 } },
    { label: 'リモート分散で自由度', w: { worklife: 0.5, autonomy: 0.5 } },
  ]},
  { id: 'y3q4', year: 3, text: '3年目の選択は？', options: [
    { label: '現職で昇進狙い', w: { stability: 0.5, speed: 0.5 } },
    { label: '社内異動で最適化', w: { collab: 0.5, stability: 0.5 } },
    { label: '転職準備を進める', w: { autonomy: 0.5, growth: 0.5 } },
  ]},
];

// ============================
// Utilities
// ============================
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function combineVectors(base: number[], sens: number[], sizeD: number[], sizeM: number[], user: number[]) {
  const arr = base.map((b, i) => b + sizeD[i] + sens[i] * sizeM[i] * user[i]);
  return arr.map(clamp01);
}

function normalizeStars(stars: number) {
  return clamp01((stars - 1) / 4);
}

// Salary & Overtime predictors (simple proxy)
function predictSalary(vec: number[], industry: string, sizeIdx: number|null) {
  const sp = vec[AXES.indexOf('speed')];
  const gr = vec[AXES.indexOf('growth')];
  const au = vec[AXES.indexOf('autonomy')];
  const sizeBonus = sizeIdx===0? 30 : sizeIdx===1? 10 : 0; // 万円
  const indBase = industry === 'コンサル' ? 420 : industry === '商社' ? 400 : industry === 'SE' ? 380 : industry === '広告' ? 370 : 360;
  const salary = Math.round(indBase + sp*180 + gr*120 + au*40 + sizeBonus);
  return Math.max(300, Math.min(800, salary));
}
function predictOvertime(vec: number[], industry: string, sizeIdx: number|null) {
  const wl = vec[AXES.indexOf('worklife')];
  const sp = vec[AXES.indexOf('speed')];
  let base = 45 - (wl*20) + (sp*10);
  if (industry === 'コンサル' || industry === '広告') base += 10;
  if (sizeIdx===0) base += 5; // 大手は調整・会議多め仮定
  return Math.max(10, Math.min(80, Math.round(base)));
}

// ============================
// Small UI Atoms
// ============================
function SectionCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ background: COLORS.white, borderRadius: 16, boxShadow: "0 10px 24px rgba(0,0,0,0.12)", padding: 24, border: `1px solid ${COLORS.turquoise}` }}>
      {title && <h2 style={{ color: COLORS.navy, fontWeight: 700, fontSize: 22, marginBottom: 12 }}>{title}</h2>}
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: COLORS.yellow,
      color: COLORS.red,
      borderRadius: 16,
      padding: "12px 20px",
      fontWeight: 700,
      border: `2px solid ${COLORS.yellow}`,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }}>{children}</button>
  );
}

function ChoiceCard({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: COLORS.white,
      borderRadius: 14,
      padding: 12,
      border: `2px solid ${active ? COLORS.yellow : COLORS.turquoise}`,
      color: COLORS.navy,
      fontWeight: 600,
      textAlign: 'left',
      width: '100%',
      cursor: 'pointer',
    }}>{label}</button>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v:number)=>void }) {
  return (
    <div style={{ display:'flex', gap:6 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={()=>onChange(n)} style={{
          fontSize: 22, color: n<=value? COLORS.red : '#B0C4C4',
          background:'transparent', border:'none', cursor:'pointer'
        }}>★</button>
      ))}
    </div>
  );
}

function Slider({ min, max, step, value, onChange, unit }: { min:number; max:number; step:number; value:number; onChange:(v:number)=>void; unit?:string }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))} />
      <div style={{ color: COLORS.navy, fontWeight: 700 }}>{value}{unit||''}</div>
    </div>
  );
}

// ============================
// Main Component
// ============================
const INDUSTRIES = Object.keys(INDUSTRY_PROFILE);
const JOBS = ["技術系", "事務系", "営業", "戦略コンサルタント", "ビジネスコンサルタント", "SIer", "SE", "デザイン"];

export default function CareerSimulator() {
  // steps: 0:intro, 1:select, 2:goals, 3:y1, 4:y2, 5:y3, 6:result
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<string>('');
  const [sizeIdx, setSizeIdx] = useState<number | null>(null); // 初期選択なし
  const [role, setRole] = useState<string>('');

  // goals page states
  const [salaryGoal, setSalaryGoal] = useState<number>(500); // 万円
  const [otGoal, setOtGoal] = useState<number>(20); // h/月
  const [stars, setStars] = useState<{ [K in typeof AXES[number]]?: number }>({
    worklife: 3, growth: 3, autonomy: 3, stability: 3, collab: 3, speed: 3,
  });

  // answers for 12 questions
  const [answers, setAnswers] = useState<Record<string, number>>({}); // question.id -> option index

  const allYearsAnswered = (year: 1|2|3) => QUESTIONS.filter(q=>q.year===year).every(q => answers[q.id] !== undefined);

  // Build user vector from stars + events (0.6:0.4)
  const userVector = useMemo(() => {
    // from stars (goals)
    let baseVec = AXES.map(ax => normalizeStars(stars[ax] || 3));

    // events aggregation
    const acc: Record<typeof AXES[number], number> = { growth:0, collab:0, autonomy:0, stability:0, worklife:0, speed:0 };
    QUESTIONS.forEach(q => {
      const idx = answers[q.id];
      if (idx === undefined) return;
      const opt = q.options[idx];
      Object.entries(opt.w).forEach(([k,v]) => { acc[k as typeof AXES[number]] += (v as number); });
    });
    const eventVec = AXES.map(ax => clamp01(0.5 + acc[ax]/8));

    return AXES.map((_, i) => clamp01(0.6*baseVec[i] + 0.4*eventVec[i]));
  }, [stars, answers]);

  const radarData = useMemo(() => {
    if (!industry || sizeIdx===null) return null;
    const ind = INDUSTRY_PROFILE[industry];
    const sz = SIZE_PROFILE[sizeIdx];
    const you = combineVectors(ind.base, ind.sens, sz.d, sz.m, userVector);
    const avg = ind.base.map((b,i)=>clamp01(b + sz.d[i]));
    const target = AXES.map(ax => normalizeStars(stars[ax] || 3));
    return AXES.map((ax, i) => ({ axis: AXIS_LABEL[ax], you: you[i], avg: avg[i], target: target[i] }));
  }, [industry, sizeIdx, userVector, stars]);

  const predictedSalary = useMemo(()=>predictSalary(userVector, industry, sizeIdx), [userVector, industry, sizeIdx]);
  const predictedOt = useMemo(()=>predictOvertime(userVector, industry, sizeIdx), [userVector, industry, sizeIdx]);

  const progress = Math.round((step/6)*100);

  return (
    <div style={{ minHeight: '100vh', background: COLORS.turquoise, padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>
        {/* Header */}
        <header style={{ color: COLORS.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontWeight: 800, fontSize: 24 }}>新卒就活用志望業界シミュレーター</h1>
          <div style={{ fontWeight: 700 }}>{progress}%</div>
        </header>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.35)', borderRadius: 999 }}>
          <div style={{ width: `${progress}%`, height: 6, background: COLORS.yellow, borderRadius: 999 }} />
        </div>

        {/* Step 0: Intro */}
        {step === 0 && (
          <SectionCard title="はじめに">
            <p style={{ color: COLORS.navy, lineHeight: 1.8 }}>
              あなたの志望する業界やその後の選択に合わせて、3年後のキャリア像と満足度の推移を可視化します。<br />
              深層学習による評価の最適化を試みていますが、結果はあくまで参考値です。<br />
              現実とのギャップを意識しながら、次のキャリアを考える材料としてご利用ください。
            </p>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={() => setStep(1)}>シミュレーションを始める</PrimaryButton>
            </div>
          </SectionCard>
        )}

        {/* Step 1: Industry / Role / Size */}
        {step === 1 && (
          <SectionCard title="業界・職種・企業規模の選択">
            <div style={{ borderBottom: `2px solid ${COLORS.turquoise}`, paddingBottom: 16, marginBottom: 24 }}>
              <label style={{ color: COLORS.navy, fontWeight: 700 }}>業界</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 8 }}>
                {INDUSTRIES.map((name) => (
                  <ChoiceCard key={name} label={name} active={industry === name} onClick={() => setIndustry(name)} />
                ))}
              </div>
            </div>

            <div style={{ borderBottom: `2px solid ${COLORS.turquoise}`, paddingBottom: 16, marginBottom: 24 }}>
              <label style={{ color: COLORS.navy, fontWeight: 700 }}>職種</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 8 }}>
                {JOBS.map((job) => (
                  <ChoiceCard key={job} label={job} active={role === job} onClick={() => setRole(job)} />
                ))}
              </div>
            </div>

            <div>
              <label style={{ color: COLORS.navy, fontWeight: 700 }}>企業規模</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
                {SIZE_PROFILE.map((sz, i) => (
                  <ChoiceCard key={sz.label} label={sz.label} active={sizeIdx===i} onClick={()=>setSizeIdx(i)} />
                ))}
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => setStep(2)} disabled={!industry || !role || sizeIdx===null}>次へ</PrimaryButton>
            </div>
          </SectionCard>
        )}

        {/* Step 2: Goals (salary & overtime sliders + star ratings) */}
        {step === 2 && (
          <SectionCard title="3年後の理想を設定">
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ color: COLORS.navy, fontWeight: 700, marginBottom: 6 }}>理想の年収（万円）</div>
                <Slider min={300} max={800} step={10} value={salaryGoal} onChange={setSalaryGoal} unit="万円" />
              </div>
              <div>
                <div style={{ color: COLORS.navy, fontWeight: 700, marginBottom: 6 }}>理想の平均残業（時間/月）</div>
                <Slider min={0} max={80} step={1} value={otGoal} onChange={setOtGoal} unit="h" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap: 16 }}>
                {AXES.map(ax => (
                  <div key={ax}>
                    <div style={{ color: COLORS.navy, fontWeight: 700, marginBottom: 6 }}>{AXIS_LABEL[ax]}</div>
                    <StarRating value={stars[ax] || 3} onChange={(v)=>setStars(s=>({...s, [ax]: v}))} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 24, display:'flex', justifyContent:'space-between' }}>
              <PrimaryButton onClick={()=>setStep(1)}>戻る</PrimaryButton>
              <PrimaryButton onClick={()=>setStep(3)}>次へ</PrimaryButton>
            </div>
          </SectionCard>
        )}

        {/* Step 3..5: Yearly Questions (4 per year) */}
        {[3,4,5].map((s) => (
          step === s && (
            <SectionCard key={s} title={`${s-2}年目のイベント`}>
              {QUESTIONS.filter(q=>q.year===(s-2)).map(q => (
                <div key={q.id} style={{ marginBottom: 16 }}>
                  <div style={{ color: COLORS.navy, fontWeight: 700, marginBottom: 8 }}>{q.text}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
                    {q.options.map((opt, i) => (
                      <ChoiceCard key={i} label={opt.label} active={answers[q.id]===i} onClick={()=>setAnswers(a=>({...a,[q.id]:i}))} />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <PrimaryButton onClick={() => setStep(s-1)}>戻る</PrimaryButton>
                <PrimaryButton onClick={() => setStep(s+1)} disabled={!QUESTIONS.filter(q=>q.year===(s-2)).every(q=>answers[q.id]!==undefined)}>次へ</PrimaryButton>
              </div>
            </SectionCard>
          )
        ))}

        {/* Step 6: Result (Radar + predicted salary/overtime + goals) */}
        {step === 6 && (
          <SectionCard title="結果：3年後のあなた">
            {!radarData ? (
              <p style={{ color: COLORS.navy }}>業界と企業規模を選択してください。</p>
            ) : (
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '280px 1fr' }}>
                {/* Left: Predicted numbers */}
                <div style={{ background: COLORS.white, border: `1px solid ${COLORS.turquoise}`, borderRadius: 16, padding: 12 }}>
                  <div style={{ color: COLORS.navy, fontWeight: 800, marginBottom: 8 }}>予測サマリー</div>
                  <div style={{ color: COLORS.navy, lineHeight: 1.8 }}>
                    <div>予想される年収（3年目）：<b>{predictedSalary}万円</b></div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>目標：{salaryGoal}万円</div>
                    <div style={{ marginTop: 8 }}>予想される平均残業：<b>{predictedOt}時間/月</b></div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>目標：{otGoal}時間/月</div>
                    <hr style={{ borderColor: COLORS.turquoise, margin: '12px 0' }} />
                    <div>業界：<b>{industry}</b></div>
                    <div>規模：<b>{SIZE_PROFILE[sizeIdx!].label}</b></div>
                    <div>職種：<b>{role}</b></div>
                  </div>
                </div>

                {/* Right: Radar */}
                <div>
                  <div style={{ background: COLORS.white, borderRadius: 16, padding: 12, border: `1px solid ${COLORS.turquoise}` }}>
                    <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 8 }}>白いカード内に赤（あなた）／黄（業界平均）／灰（あなたの目標）</div>
                    <div style={{ width: '100%', height: 380 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                          <PolarGrid />
                          <PolarAngleAxis dataKey="axis" />
                          <PolarRadiusAxis angle={30} domain={[0,1]} />
                          <Radar name="あなた" dataKey="you" stroke={COLORS.red} fill={COLORS.red} fillOpacity={0.2} />
                          <Radar name="業界平均" dataKey="avg" stroke={COLORS.yellow} fill={COLORS.yellow} fillOpacity={0.15} />
                          <Radar name="目標" dataKey="target" stroke="#9AA3A3" fill="#9AA3A3" fillOpacity={0.1} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                    <PrimaryButton onClick={()=>setStep(5)}>戻る</PrimaryButton>
                    <PrimaryButton onClick={()=>setStep(1)}>最初からやり直す</PrimaryButton>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
