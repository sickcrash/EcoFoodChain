import { flow_auth, flow_reads, flow_write } from '../k6/lib/flows.js';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  flow_auth();
  flow_reads();
  flow_write();
}