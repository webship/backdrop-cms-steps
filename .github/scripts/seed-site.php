<?php
/**
 * @file
 * Seeds the test site with deterministic content. Run once by
 * build-ddev-backdrop-cms.sh through `bee php-script`, after the test accounts
 * exist. A feature never depends on anything that is not created here or by
 * the standard install profile.
 *
 * What it creates:
 * - the tags "Bees", "Honey" and "Hives";
 * - twelve promoted posts "Field note 01" to "Field note 12" (by the
 *   administrator, one day apart, tagged), so the home page listing has a pager;
 * - the post "Editor field note" by the editor account and the unpublished
 *   post "Unpublished field note";
 * - the pages "Visit the apiary" (linked from the primary navigation) and
 *   "Opening hours";
 * - the site name "Webship Test Site";
 * - the "Search form" block in the header of the default layout, and the
 *   permission to search for visitors and signed-in users.
 */

$editor = user_load_by_name(getenv('EDITOR_USER') ?: 'editor');
$editor_uid = $editor ? $editor->uid : 1;

// Tags.
$tids = array();
foreach (array('Bees', 'Honey', 'Hives') as $name) {
  $term = entity_create('taxonomy_term', array('name' => $name, 'vocabulary' => 'tags'));
  $term->save();
  $tids[$name] = $term->tid;
}
$tag_names = array_keys($tids);

/**
 * Saves a node.
 */
function seed_node($type, $title, $body, array $values = array(), array $tags = array()) {
  $node = entity_create('node', $values + array(
    'type' => $type,
    'title' => $title,
    'uid' => 1,
    'status' => 1,
    'promote' => 0,
    'langcode' => LANGUAGE_NONE,
  ));
  $node->body[LANGUAGE_NONE][0] = array('value' => $body, 'format' => 'filtered_html');
  foreach ($tags as $tid) {
    $node->field_tags[LANGUAGE_NONE][] = array('tid' => $tid);
  }
  $node->save();
  return $node;
}

// Twelve promoted posts, the oldest first: "Field note 12" is the newest.
$start = strtotime('2026-01-01 09:00:00 UTC');
for ($i = 1; $i <= 12; $i++) {
  $number = str_pad($i, 2, '0', STR_PAD_LEFT);
  $tag = $tag_names[($i - 1) % 3];
  seed_node('post', "Field note $number", "<p>Observation number $number from the apiary, filed under $tag.</p>", array(
    'promote' => 1,
    'created' => $start + $i * 86400,
    'changed' => $start + $i * 86400,
  ), array($tids[$tag]));
}

seed_node('post', 'Editor field note', '<p>A note written by the editor account about the queen cells.</p>', array(
  'uid' => $editor_uid,
  'created' => $start + 20 * 86400,
), array($tids['Bees']));

seed_node('post', 'Unpublished field note', '<p>This note waits for a review.</p>', array(
  'status' => 0,
  'created' => $start + 21 * 86400,
));

// Pages; the first one sits in the primary navigation.
$visit = seed_node('page', 'Visit the apiary', '<p>The apiary welcomes visitors on weekends. Bring a veil.</p>', array(
  'created' => $start + 22 * 86400,
));
$item = array(
  'link_path' => 'node/' . $visit->nid,
  'link_title' => 'Visit the apiary',
  'menu_name' => 'main-menu',
  'weight' => 5,
);
menu_link_save($item);

seed_node('page', 'Opening hours', '<p>Saturday and Sunday, from nine to five.</p>', array(
  'created' => $start + 23 * 86400,
));

// The name of the site (a name with spaces does not survive the command line of the installer).
config_set('system.core', 'site_name', 'Webship Test Site');

// Visitors and signed-in users may search.
user_role_grant_permissions(BACKDROP_ANONYMOUS_ROLE, array('search content'));
user_role_grant_permissions(BACKDROP_AUTHENTICATED_ROLE, array('search content'));

// The search form in the header of the default layout.
$layout = layout_load('default');
$block = $layout->addBlock('search', 'form', 'header');
$layout->save();

menu_rebuild();
print "Seeded " . db_query('SELECT COUNT(*) FROM {node}')->fetchField() . " nodes.\n";
