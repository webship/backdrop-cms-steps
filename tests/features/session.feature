@session
Feature: Logging in and out
  As a tester of a site
  I want to log in with the accounts of the users registry and log out
  So that scenarios start from a known session

  # The accounts are created once by the site build script and named in
  # cucumber.js (worldParameters.users). No scenario creates or deletes one.

  @critical
  Scenario: The administrator logs in and lands on a signed-in page
    Given I am logged in as "admin"
    Then I should be logged in as "admin"
    And I should have a session cookie
    And I should not be logged in as "editor"

  Scenario: The editor logs in through the log in form
    Given I am an anonymous user
    When I log in as "editor"
    Then I should be logged in as "editor"

  Scenario: Logging in as another account replaces the session
    Given I am logged in as "editor"
    When I sign in as "member"
    Then I should be logged in as "member"
    And I should not be logged in as "editor"

  @critical
  Scenario: Logging out ends the session
    Given I am logged in as "member"
    When I log out of the site
    Then I should be logged out
    And I should not have a session cookie

  Scenario: A visitor has no session
    Given I am an anonymous user
    Then I should be logged out
    And I should not have a session cookie

  Scenario: A wrong password is refused with an error message
    When I submit the log in form with the username "member" and the password "not-the-password"
    Then the error message should contain "Sorry, incorrect password."
    And there should be an error message
    And I should be logged out

  Scenario: An unknown account is refused with an error message
    When I submit the log in form with the username "nobody-here" and the password "secret"
    Then the error message should contain "Sorry, unrecognized username."
    And I should be logged out

  Scenario: The error message of a failed log in can be dismissed
    When I submit the log in form with the username "nobody-here" and the password "secret"
    Then there should be an error message
    When I dismiss the error message
    Then there should be no error messages

  Scenario: A visitor asks for a password reset
    Given I am an anonymous user
    When I ask for a password reset for "member"
    Then the status message should contain "Further instructions have been sent to your email address."
    And there should be no error messages

  Scenario: A signed-in user opens the account page
    Given I am logged in as "member"
    When I open my account page
    Then the page heading should be "member"
    And I should see the "Edit" page tab
