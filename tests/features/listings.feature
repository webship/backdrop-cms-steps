@administration @listings
Feature: Listings of the administration
  As a tester of a site
  I want to filter, sort and read the listings and use the operations and bulk actions of their rows
  So that the content, file and account listings are covered

  Background:
    Given I am logged in as "admin"

  @critical
  Scenario: The content listing lists the seeded content
    Given I am on the "content" administration page
    Then the listing should list "Field note 01"
    And the listing should list "Visit the apiary"
    And the listing should list "Unpublished field note"
    And the listing should not list "No such content"
    And the listing should have at least 20 rows

  Scenario: The content listing is filtered by type
    Given I am on the "content" administration page
    When I filter the listing by "Type" with "Page"
    Then the listing should list "Visit the apiary"
    And the listing should list "Opening hours"
    And the listing should not list "Field note 01"

  Scenario: The content listing is filtered by published state
    Given I am on the "content" administration page
    When I filter the listing by "Published" with "No"
    Then the listing should have 1 row
    And the listing should list "Unpublished field note"
    And I should see "Not published" in the "Unpublished field note" row

  Scenario: The content listing is filtered by title
    Given I am on the "content" administration page
    When I filter the listing by "Title contains" with "Editor"
    Then the listing should have 1 row
    And the listing should list "Editor field note"
    When I filter the listing by "Title contains" with "zzznothingzzz"
    Then the listing should have no rows

  Scenario: The content listing is sorted by title
    Given I am on the "content" administration page
    When I filter the listing by "Type" with "Page"
    And I sort the listing by "Title"
    Then the listing should start with "About"
    When I sort the listing by "Title"
    Then the listing should start with "Visit the apiary"

  Scenario: The rows of the content listing offer their operations
    Given I am on the "content" administration page
    Then the "Field note 01" row should offer the "Edit" operation
    And the "Field note 01" row should offer the "Delete" operation
    And the "Field note 01" row should not offer the "Manage blocks" operation
    When I choose the "Edit" operation of the "Field note 01" row
    Then the page heading should be "Edit Post Field note 01"

  Scenario: An operation behind the arrow of the drop button leads to its confirmation
    Given I am on the "content" administration page
    When I choose the "Delete" operation of the "Opening hours" row
    Then I should be asked to confirm "Are you sure you want to delete Opening hours?"
    When I cancel the confirmation
    Then the listing should list "Opening hours"

  Scenario: Bulk actions unpublish, publish and delete the selected rows
    Given the content "Bulk note one from the suite" does not exist
    And the content "Bulk note two from the suite" does not exist
    When I start a new "Post"
    And I enter "Bulk note one from the suite" in the "Title" field
    And I save the content form
    And I start a new "Post"
    And I enter "Bulk note two from the suite" in the "Title" field
    And I save the content form
    And I go to the "content" administration page
    And I select the row "Bulk note one from the suite" of the listing
    And I select the row "Bulk note two from the suite" of the listing
    And I apply the "Unpublish content" action to the selected rows
    Then there should be no error messages
    And the content "Bulk note one from the suite" should have the status "Not published"
    And the content "Bulk note two from the suite" should have the status "Not published"
    And the content "Field note 03" should have the status "Published"
    When I go to the "content" administration page
    And I filter the listing by "Published" with "No"
    And I select the row "Bulk note one from the suite" of the listing
    And I apply the "Publish content" action to the selected rows
    Then the content "Bulk note one from the suite" should have the status "Published"
    And the content "Bulk note two from the suite" should have the status "Not published"
    When I go to the "content" administration page
    And I select the row "Bulk note one from the suite" of the listing
    And I select the row "Bulk note two from the suite" of the listing
    And I apply the "Delete content" action to the selected rows
    Then I should be asked to confirm "Are you sure you want to delete"
    When I confirm with "Delete"
    Then the content "Bulk note one from the suite" should not exist
    And the content "Bulk note two from the suite" should not exist

  Scenario: A bulk delete asks for confirmation and can be cancelled
    Given I am on the "content" administration page
    When I select the row "Opening hours" of the listing
    And I apply the "Delete content" action to the selected rows
    Then I should be asked to confirm "Are you sure you want to delete"
    When I cancel the confirmation
    Then the content "Opening hours" should exist

  Scenario: The other listings are read the same way
    Given I am on the "menus" administration page
    Then the listing should list "Primary navigation"
    And the "Primary navigation" row should offer the "Manage links" operation
    When I go to the "taxonomy" administration page
    Then the listing should list "Tags"
    When I choose the "List terms" operation of the "Tags" row
    Then the listing should list "Bees"
    And the listing should have 3 rows
    When I go to the "files" administration page
    Then the listing should list "card1-layout.png"
    When I go to the "user accounts" administration page
    Then the listing should have 3 rows
    And the listing should list "editor"
