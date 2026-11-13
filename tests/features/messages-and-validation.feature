@messages
Feature: Messages and form errors
  As a tester of a site
  I want to assert the status, warning and error messages and the fields a form marks as errors
  So that the feedback of the site is covered

  Scenario: A status message confirms an action and is dismissed
    Given I am logged in as "admin"
    And I am on "/visit-the-apiary"
    When I flush all caches from the administration bar
    Then there should be a status message
    And the status message should be "Every cache cleared."
    And the status message should not contain "error"
    And there should be no error messages
    And there should be no warning messages
    When I dismiss the status message
    Then there should be no status messages

  Scenario: An error message names the field that was refused
    Given I am logged in as "editor"
    When I start a new "Post"
    And browser validation for the form "form.node-form" is disabled
    And I press "Save"
    Then there should be an error message
    And the error message should be "Title field is required."
    And the error message should not contain "Body"
    And the "Title" field should be marked as an error
    And the "Tags" field should not be marked as an error
    When I dismiss the error message
    Then there should be no error messages

  Scenario: A warning message tells the layout has unsaved changes
    Given I am logged in as "admin"
    And the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    Then there should be no warning messages
    When I add the "Syndicate" block to the "Sidebar" region
    Then there should be a warning message
    And the warning message should contain "unsaved changes"
    When I cancel the layout changes
    Then the status message should be "Layout changes discarded."

  Scenario: The log in form marks nothing but tells why it refused
    When I submit the log in form with the username "member" and the password "wrong-password"
    Then the error message should contain "Sorry, incorrect password."
    And there should be no status messages

  Scenario: The values of a form are read by their labels
    Given I am logged in as "editor"
    When I edit the content "Field note 01"
    Then the "Title" field should have the value "Field note 01"
    And the "Title" field should not have the value "Field note 02"
    And the "Tags" field should have the value "Bees"
    When I enter "Changed, but not saved" in the "Title" field
    Then the "Title" field should have the value "Changed, but not saved"
