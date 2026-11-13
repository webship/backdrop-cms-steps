@a11y
Feature: Accessibility of the stock pages
  As a tester of a site
  I want to run webship-js's accessibility checks on the pages the platform renders
  So that the pack composes with the built-in steps

  Scenario: The home page has the basics of an accessible page
    Given I am on the homepage
    Then the page should have a title
    And user zoom should be allowed

  Scenario: A content page has one main heading and a skip link
    Given I am on "/visit-the-apiary"
    Then the page should have exactly one h1
    And the page should have a title
    And I should see 1 "#skip-link a" elements

  Scenario: The log in form labels its fields
    Given I am on "/user/login"
    Then every form field should have an accessible label
    And the page should have exactly one h1
