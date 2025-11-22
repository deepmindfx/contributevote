-- Enable real-time updates for group_refund_requests table
-- This allows clients to subscribe to changes in refund voting

ALTER PUBLICATION supabase_realtime ADD TABLE group_refund_requests;

COMMENT ON TABLE group_refund_requests IS 
  'Group refund requests with real-time voting updates enabled';

