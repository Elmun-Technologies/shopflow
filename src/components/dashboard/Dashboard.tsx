import { useState } from "react";
import PeriodSelector, { rangeForPreset, type PeriodPreset, type PeriodRange } from "./PeriodSelector";
import MainKPICards from "./MainKPICards";
import EarningStatistics from "./EarningStatistics";
import OrderStatistics from "./OrderStatistics";
import TrafficSourceChart from "./TrafficSourceChart";
import Top10Products from "./Top10Products";
import OrdersPeakChart from "./OrdersPeakChart";
import Top10Customers from "./Top10Customers";

export default function Dashboard() {
  const [preset, setPreset] = useState<PeriodPreset>("weekly");
  const [range, setRange] = useState<PeriodRange>(rangeForPreset("weekly"));

  return (
    <div>
      <PeriodSelector
        preset={preset}
        range={range}
        onChange={(p, r) => { setPreset(p); setRange(r); }}
      />

      <MainKPICards range={range} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><EarningStatistics range={range} /></div>
        <OrderStatistics />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <TrafficSourceChart />
        <Top10Products />
      </div>

      <div className="mt-4">
        <OrdersPeakChart range={range} />
      </div>

      <div className="mt-4">
        <Top10Customers />
      </div>
    </div>
  );
}
