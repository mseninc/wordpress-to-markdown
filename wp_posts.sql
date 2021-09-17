SELECT
  p.`ID` AS `id`
, p.`post_author` AS `author_id`
, u.`display_name` AS `author_name`
, p.`post_date` AS `date`
, p.`post_title` AS `title`
, p.`post_name` AS `slug`
, p.`post_content_filtered`
, p.`post_status`
, i.`guid` AS `imageUrl`
, GROUP_CONCAT(t.`name` separator ', ') as `tagnames`

FROM `wp_posts` AS p

  INNER JOIN `wp_users` AS u
    ON p.`post_author` = u.`ID`

  INNER JOIN `wp_term_relationships` tr
    ON tr.`object_id` = p.`ID`

  INNER JOIN `wp_term_taxonomy` AS tt
    ON tt.`taxonomy` IN ('post_tag', 'category')
    AND tt.`term_taxonomy_id` = tr.`term_taxonomy_id`

  INNER JOIN `wp_terms` AS t
    ON t.`term_id` = tt.`term_id`
    
  LEFT JOIN `wp_postmeta` AS m
    ON m.`post_id` = p.`ID`
    AND m.`meta_key` = '_thumbnail_id'

  LEFT JOIN `wp_posts` AS i
    ON i.`ID` = m.`meta_value`

WHERE p.`post_type` = 'post'

GROUP BY
  p.`ID`
, p.`post_author`
, u.`display_name`
, p.`post_date`
, p.`post_title`
, p.`post_name`
, p.`post_content_filtered`
, p.`post_status`
, i.`guid`

ORDER BY
  p.`post_date`
;
