@content
Feature: Creating, editing, publishing and deleting content
  As a tester of a site
  I want to create posts and pages, change their published state, schedule them and delete them
  So that the life of a piece of content is covered

  # Every scenario removes the content it creates. The "does not exist" steps at
  # the start make a scenario safe to run again after a failed run.

  @critical
  Scenario: The editor creates, edits and deletes a post
    Given I am logged in as "editor"
    And the content "A note from the suite" does not exist
    And the content "A note from the suite, edited" does not exist
    When I start a new "Post"
    Then the page heading should be "Create Post"
    When I enter "A note from the suite" in the "Title" field
    And I write "<p>The swarm settled in the old oak.</p>" in the "Body" editor
    And I save the content form
    Then the status message should be "Post A note from the suite has been created."
    And the page heading should be "A note from the suite"
    And I should see "The swarm settled in the old oak."
    And the content on the page should be published
    When I open the "Edit" page tab
    And I enter "A note from the suite, edited" in the "Title" field
    And I save the content form
    Then the status message should contain "has been updated."
    And the page heading should be "A note from the suite, edited"
    And the content "A note from the suite, edited" should exist
    And the content "A note from the suite" should not exist
    When I delete the content "A note from the suite, edited"
    Then the status message should contain "has been deleted."
    And the content "A note from the suite, edited" should not exist

  Scenario: The administrator creates a page and deletes it from its edit form
    Given I am logged in as "admin"
    And the content "A page from the suite" does not exist
    When I start a new "Page"
    And I enter "A page from the suite" in the "Title" field
    And I write "A plain sentence about the apiary." in the "Body" editor
    And I save the content form
    Then the status message should be "Page A page from the suite has been created."
    And the content on the page should be published
    When I edit the content "A page from the suite"
    And I click "Delete"
    Then I should be asked to confirm "Are you sure you want to delete A page from the suite?"
    When I confirm with "Delete"
    Then the status message should be "Page A page from the suite has been deleted."
    And the content "A page from the suite" should not exist

  Scenario: A post is saved as a draft, then published
    Given I am logged in as "editor"
    And the content "Draft from the suite" does not exist
    When I start a new "Post"
    And I enter "Draft from the suite" in the "Title" field
    And I set the content to be a draft
    Then the "Publishing actions" vertical tab summary should contain "Save as draft"
    When I save the content form
    Then the content on the page should be unpublished
    And the content "Draft from the suite" should have the status "Not published"
    When I edit the content "Draft from the suite"
    Then the "Publishing options" vertical tab summary should contain "Draft"
    When I set the content to be published
    And I save the content form
    Then the status message should be "Post Draft from the suite has been updated."
    And the content "Draft from the suite" should have the status "Published"
    When I view the content "Draft from the suite"
    Then the content on the page should be published
    When I delete the content "Draft from the suite"
    Then the content "Draft from the suite" should not exist

  Scenario: A draft with its own address is hidden from visitors
    Given I am logged in as "admin"
    And the content "Hidden draft from the suite" does not exist
    When I start a new "Post"
    And I enter "Hidden draft from the suite" in the "Title" field
    And I set the content to be a draft
    And I switch to the "URL settings" vertical tab
    And I uncheck "Generate automatic URL alias"
    And I enter "hidden-draft-from-the-suite" in the "URL alias" field
    Then the "URL settings" vertical tab summary should contain "hidden-draft-from-the-suite"
    When I save the content form
    Then I should have access to "hidden-draft-from-the-suite"
    When I log out of the site
    Then I should not have access to "hidden-draft-from-the-suite"
    Given I am logged in as "admin"
    When I delete the content "Hidden draft from the suite"
    Then the content "Hidden draft from the suite" should not exist

  Scenario: A post is scheduled for later
    Given I am logged in as "editor"
    And the content "Scheduled note" does not exist
    When I start a new "Post"
    And I enter "Scheduled note" in the "Title" field
    And I schedule the content for "2031-05-01" at "09:30"
    And I save the content form
    Then the status message should contain "Post will be published on"
    And the content on the page should be unpublished
    And the content "Scheduled note" should have the status "Not published (Scheduled)"
    When I delete the content "Scheduled note"
    Then the content "Scheduled note" should not exist

  Scenario: The content form is refused without a title
    Given I am logged in as "editor"
    When I start a new "Page"
    And I press "Save"
    Then the error message should be "Title field is required."
    And the "Title" field should be marked as an error
    And the "Body" field should not be marked as an error
    And there should be no status messages

  Scenario: The vertical tabs of the content form follow the account
    Given I am logged in as "admin"
    When I start a new "Page"
    Then I should see the "Menu settings" vertical tab
    And I should see the "URL settings" vertical tab
    When I switch to the "URL settings" vertical tab
    Then the "URL settings" vertical tab summary should contain "Automatic alias"
    And I should see "Generate automatic URL alias"
    Given I am logged in as "editor"
    When I start a new "Page"
    Then I should not see the "Menu settings" vertical tab
    And I should see the "Publishing actions" vertical tab

  Scenario: A collapsible fieldset of the content form opens and closes
    Given I am logged in as "editor"
    When I start a new "Post"
    And I expand the "Formatting options" fieldset
    Then I should see "Allowed HTML tags"
    When I collapse the "Formatting options" fieldset
    Then "fieldset.filter-wrapper .filter-guidelines" should not be visible

  Scenario: The account without the permission is not offered a content type
    Given I am logged in as "member"
    Then I should not have access to "node/add"
    And I should not have access to "node/add/post"

  Scenario: A page gets a link in the primary navigation from its form
    Given I am logged in as "admin"
    And the content "Hive tour from the suite" does not exist
    When I start a new "Page"
    And I enter "Hive tour from the suite" in the "Title" field
    And I give the content the menu link "Hive tour"
    Then the "Menu settings" vertical tab summary should contain "Hive tour"
    When I save the content form
    Then the primary navigation should list "Hive tour"
    When I click "Hive tour" in the primary navigation
    Then the page heading should be "Hive tour from the suite"
    When I delete the content "Hive tour from the suite"
    Then the content "Hive tour from the suite" should not exist
    And the "Primary navigation" menu should not have the link "Hive tour"
