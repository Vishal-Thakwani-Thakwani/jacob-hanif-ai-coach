CREATE OR REPLACE FUNCTION get_recent_conversations_with_last_message(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (conv_id UUID, title TEXT, last_user_message TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.title, (
        SELECT m.content FROM messages m
        WHERE m.conversation_id = c.id AND m.role = 'user'
        ORDER BY m.created_at DESC LIMIT 1
    )
    FROM conversations c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
