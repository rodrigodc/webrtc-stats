import { computeMos, extract } from "./extractor";
import { defaultMetric } from "./utils/helper";
import { debug, error } from "./utils/log";

const moduleName = "analyzer    ";

export default class Analyzer {
  constructor(pc, name, cid, uid) {
    this._callbacks = {
      onmetrics: null,
    };

    this._pc = pc;
    this._name = name;
    this._callid = cid;
    this._userid = uid;
    this._intervalId = null;
  }

  analyze(reports) {
    const metrics = defaultMetric;

    metrics.name = this._name;
    metrics.call_id = this._callid;
    metrics.user_id = this._userid;

    reports.forEach((report) => {
      if (!metrics.timestamp && report.timestamp) {
        metrics.timestamp = report.timestamp;
      }
      const values = extract(report);
      values.forEach((data) => {
        if (data.value && data.type) {
          Object.keys(data.value).forEach((key) => {
            metrics[data.type][key] = data.value[key];
          });
        }
      });
    });

    metrics.audio.mos = computeMos(metrics);
    return metrics;
  }

  async start({ refreshTimer }) {
    const getStats = async () => {
      if (!this._pc) {
        return;
      }
      try {
        const reports = await this._pc.getStats();
        debug(moduleName, "getstats() - analyze in progress...");

        const metrics = this.analyze(reports);

        this.fireOnMetrics(metrics);
      } catch (err) {
        error(moduleName, `getStats() - error ${err}`);
      }
    };

    if (this._intervalId) {
      debug(moduleName, `start() - clear analyzer with id ${this._intervalId}`);
      clearInterval(this._intervalId);
    }

    debug(moduleName, "start() - start analyzing...");
    this._intervalId = setInterval(() => {
      getStats();
    }, refreshTimer);
  }

  stop() {
    if (!this._intervalId) {
      return;
    }

    clearInterval(this._intervalId);
  }

  registerCallback(name, callback, context) {
    if (name in this._callbacks) {
      this._callbacks[name] = { callback, context };
      debug(moduleName, `registered callback '${name}'`);
    } else {
      error(moduleName, `can't register callback for '${name}'`);
    }
  }

  fireOnMetrics(stats) {
    const call = (fct, context, value) => {
      if (!context) {
        fct(value);
      } else {
        fct.call(context, value);
      }
    };

    if (this._callbacks.onmetrics) {
      call(this._callbacks.onmetrics.callback, this._callbacks.onmetrics.context, stats);
    }
  }
}
