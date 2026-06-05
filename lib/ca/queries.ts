// GraphQL documents for the CriticalAsset API. Field selections are kept in sync
// with the real schema (verified via introspection). Notably we do NOT select
// workOrderAssignments.users — that resolver is broken upstream
// (`column u.phone does not exist`) — so we read userIds only.

const WORK_ORDER_FIELDS = `
  id
  title
  description
  executionPriority
  severity
  workOrderServiceCategory
  createdAt
  endDate
  workOrderStage { id name }
  location { id locationName address }
  workOrderAssets { id assetId asset { id name status lastServiceDate } }
  workOrderAssignments { id assignmentType userIds }
`;

export const LIST_WORK_ORDERS = `
  query ListWorkOrders($limit: Int!, $offset: Int) {
    workOrders(limit: $limit, offset: $offset) {
      totalCount
      nodes { ${WORK_ORDER_FIELDS} }
    }
  }`;

export const GET_WORK_ORDER = `
  query GetWorkOrder($id: ID!) {
    workOrder(id: $id) { ${WORK_ORDER_FIELDS} }
  }`;
