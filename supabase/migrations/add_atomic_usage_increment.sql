-- Atomic usage increment RPC to prevent race conditions
CREATE OR REPLACE FUNCTION increment_daily_usage(p_user_id UUID, p_field TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    date DATE,
    message_count INT,
    image_uploads INT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO daily_usage (user_id, date, message_count, image_uploads)
    VALUES (
        p_user_id,
        CURRENT_DATE,
        CASE WHEN p_field = 'message_count' THEN 1 ELSE 0 END,
        CASE WHEN p_field = 'image_uploads' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        message_count = daily_usage.message_count + CASE WHEN p_field = 'message_count' THEN 1 ELSE 0 END,
        image_uploads = daily_usage.image_uploads + CASE WHEN p_field = 'image_uploads' THEN 1 ELSE 0 END
    RETURNING daily_usage.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
